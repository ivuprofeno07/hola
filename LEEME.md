# Sentinel en la nube con acceso privado

El paquete contiene el código y la configuración para ejecutar Sentinel en una máquina Linux con Docker y Compose. La base de datos se guarda en un volumen persistente y el servicio se reinicia automáticamente con la máquina. La primera instalación empieza con una base de datos nueva.

1. Crea una máquina Linux que figure como **Always Free** en la consola de Oracle. Comprueba la estimación de coste antes de crearla. La disponibilidad depende de la región.
2. Conéctate a la máquina por SSH. Instala Docker y su complemento Compose. Sube y extrae este paquete en la máquina.
3. Desde la carpeta extraída, ejecuta `docker compose up -d --build`. El paquete publica el puerto de Sentinel únicamente en la interfaz local de la máquina.
4. Comprueba la aplicación desde la máquina con `curl -fsS http://127.0.0.1:3000/api/ai/status`.
5. Instala Tailscale en la máquina, conéctala a tu red privada y ejecuta `sudo tailscale serve --bg 3000`. Abre la dirección HTTPS que muestra Tailscale desde un dispositivo de tu red privada. Las personas o dispositivos con acceso a Sentinel pueden usar sus controles de administración.

La aplicación mantiene su planificador de actualizaciones mientras la máquina esté encendida. Si quieres conservar tus listas y noticias guardadas, migra la base de datos mediante una copia coherente de SQLite por un canal privado antes de habilitar el servicio para su uso. El paquete no incluye datos ni claves locales.

- Oracle Cloud Always Free: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Acceso privado a un servicio Docker: https://tailscale.com/docs/solutions/host-private-server-docker
