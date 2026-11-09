# Sentinel

Panel de actualidad, marcadores deportivos, ciberseguridad y repositorios de GitHub. Usa Node.js 24 y SQLite.

## Ejecutar localmente

```sh
npm ci
npm test
npm run build
npm start
```

Abre http://localhost:3000. El servidor escucha en el equipo local por defecto. La base de datos se crea en `data/` y queda fuera del repositorio.

## Alojamiento privado

La [guía de despliegue](LEEME.md) describe cómo ejecutar la app en una máquina Linux con almacenamiento persistente y acceso privado por HTTPS.
