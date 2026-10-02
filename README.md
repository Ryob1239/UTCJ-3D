# Campus 3D interactivo — optimizado para Render

Proyecto listo para desplegar como **Web Service de Node.js en Render**. El plano original se usa únicamente como referencia geométrica: no se carga como fondo ni como textura.

## Optimizaciones incluidas

- Servidor compatible con Render mediante `process.env.PORT` y escucha en `0.0.0.0`.
- `render.yaml` listo para crear el servicio desde un Blueprint.
- Endpoint de salud `GET /healthz` para los health checks de Render.
- Compresión Gzip para HTML/JS/CSS/JSON/SVG.
- Caché HTTP diferenciada para HTML y recursos estáticos.
- Cierre ordenado ante `SIGTERM` para redeploys.
- Render 3D **bajo demanda**: ya no mantiene un bucle permanente de 60 FPS cuando el usuario no mueve la cámara.
- Calidad adaptativa en móviles: menor pixel ratio y sombras desactivadas en dispositivos compactos.
- Materiales Three.js reutilizados para reducir consumo de memoria.
- Coordenadas de selección por clic corregidas respecto al canvas.
- Sin modo recorrido/WASD ni Pointer Lock.

## Ejecutar localmente

Requiere Node.js 20–24.

```bash
npm install
npm start
```

Por defecto abre en:

```text
http://localhost:8088
```

También puedes definir otro puerto:

```bash
PORT=3000 npm start
```

En Windows PowerShell:

```powershell
$env:PORT=3000; npm start
```


## Ajustes visuales de esta versión

- Se retiró el patrón de cuadritos/adoquines de la zona superior alrededor del edificio O, gimnasio, campo de atletismo y cancha de básquet, sin modificar el resto del modelado.
- Se conservaron edificios, interacción, distribución general y configuración de Render.
- Las calles y superficies de estacionamiento se retrazaron como geometría vectorial siguiendo las zonas grises del plano de referencia.
- Los cajones de estacionamiento se realinearon con esas superficies.
- Las áreas verdes se retrazaron con contornos más precisos y un borde sutil para mejorar la lectura en 3D y en vista de planta.
- El render continúa siendo bajo demanda; en escritorio aumenta ligeramente la resolución y las sombras estáticas se calculan una sola vez para evitar trabajo innecesario de GPU.

## Subir a Render con GitHub

1. Descomprime esta carpeta y súbela a un repositorio de GitHub. `render.yaml` debe permanecer en la raíz.
2. En Render, crea un **Blueprint** y conecta el repositorio.
3. Render leerá automáticamente:
   - Runtime: Node
   - Build: `npm install --omit=dev`
   - Start: `npm start`
   - Health check: `/healthz`
4. Espera a que el deploy quede en estado **Live** y abre la URL `*.onrender.com` asignada.

## Configuración manual en Render

Si prefieres crear un Web Service sin Blueprint:

- **Language / Runtime:** Node
- **Build Command:** `npm install --omit=dev`
- **Start Command:** `npm start`
- **Health Check Path:** `/healthz`

No necesitas configurar un puerto manualmente. Render proporciona `PORT` y el servidor lo utiliza automáticamente.

## Archivos importantes

- `index.html`: aplicación 3D.
- `server.mjs`: servidor HTTP de producción sin dependencias externas.
- `package.json`: scripts y versión compatible de Node.
- `render.yaml`: configuración de despliegue.
- `package-lock.json`: build reproducible.
