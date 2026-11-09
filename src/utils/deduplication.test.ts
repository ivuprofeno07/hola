import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, tokenize, calculateJaccardSimilarity, isDuplicateArticle, clusterArticles } from './deduplication';
import { Article } from '../lib/types';

test('normalizeUrl strips UTM and tracking params cleanly', () => {
  const dirty = 'https://techcrunch.com/2026/11/01/new-ai-agent/?utm_source=twitter&utm_medium=social&ref=feed#anchor';
  const clean = normalizeUrl(dirty);
  assert.equal(clean, 'https://techcrunch.com/2026/11/01/new-ai-agent');
});

test('tokenize extracts meaningful lowercased word tokens ignoring stopwords', () => {
  const title = 'OpenAI launches new GPT-5 model with advanced reasoning capabilities!';
  const tokens = tokenize(title);
  assert.ok(tokens.has('openai'));
  assert.ok(tokens.has('launches'));
  assert.ok(tokens.has('reasoning'));
  assert.ok(!tokens.has('with')); // Stopword
  assert.ok(!tokens.has('the'));
});

test('calculateJaccardSimilarity returns 1 for identical sets and 0 for disjoint', () => {
  const set1 = new Set(['google', 'gemini', 'flash']);
  const set2 = new Set(['google', 'gemini', 'flash']);
  const set3 = new Set(['anthropic', 'claude', 'sonnet']);

  assert.equal(calculateJaccardSimilarity(set1, set2), 1.0);
  assert.equal(calculateJaccardSimilarity(set1, set3), 0.0);
});

test('isDuplicateArticle identifies identical URLs and near-identical coverage', () => {
  const a = {
    title: 'NVIDIA announces new Blackwell Ultra GPUs for AI data centers',
    url: 'https://reuters.com/tech/nvidia-blackwell-ultra?utm_source=rss'
  };
  const b = {
    title: 'NVIDIA unveils new Blackwell Ultra GPUs for AI data centers',
    url: 'https://theverge.com/2026/nvidia-blackwell-ultra'
  };
  assert.equal(isDuplicateArticle(a, b), true);
});

test('clusterArticles groups matching event stories into clusters', () => {
  const sampleArticles: Article[] = [
    {
      id: 'art-1',
      title: 'Google releases Gemini 2.5 Flash with real-time video audio',
      description: 'New multimodal capabilities announced.',
      source: 'TechCrunch',
      category: 'ai',
      publishedAt: '2026-11-03T10:00:00Z',
      fetchedAt: '2026-11-03T10:05:00Z',
      url: 'https://techcrunch.com/google-gemini-2-5'
    },
    {
      id: 'art-2',
      title: 'Google announces Gemini 2.5 Flash multimodal real-time release',
      description: 'Major update for AI developers.',
      source: 'The Verge',
      category: 'ai',
      publishedAt: '2026-11-03T10:15:00Z',
      fetchedAt: '2026-11-03T10:20:00Z',
      url: 'https://theverge.com/google-gemini-2-5-announcement'
    },
    {
      id: 'art-3',
      title: 'Real Madrid defeats Barcelona 2-1 in thrilling El Clásico',
      description: 'LaLiga match summary.',
      source: 'MARCA',
      category: 'sports',
      publishedAt: '2026-11-03T09:00:00Z',
      fetchedAt: '2026-11-03T09:10:00Z',
      url: 'https://marca.com/laliga/real-madrid-barcelona'
    }
  ];

  const clusters = clusterArticles(sampleArticles, 0.4);
  assert.equal(clusters.length, 2);
  const aiCluster = clusters.find(c => c.category === 'ai');
  assert.ok(aiCluster);
  assert.equal(aiCluster.articleCount, 2);
  assert.deepEqual(aiCluster.sources.sort(), ['TechCrunch', 'The Verge']);
});
