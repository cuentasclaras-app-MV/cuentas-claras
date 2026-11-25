# Cuentas Claras — cómo generar tu APK gratis

Todo se hace desde el navegador de tu computadora. No necesitas instalar nada ni programar.
GitHub compila el APK por ti, gratis, y te da un enlace de descarga para compartir.

## 1. Crea tu cuenta y tu repositorio (5 min)
1. Entra a https://github.com y crea una cuenta gratis.
2. Arriba a la derecha toca **＋ › New repository**.
3. Nombre: `cuentas-claras`. Déjalo en **Public** (así la descarga es gratis y pública). Toca **Create repository**.

## 2. Agrega las claves de firma (2 min) — antes de subir archivos
Abre el archivo `CLAVES_DE_FIRMA_NO_COMPARTIR.txt` que te entregué por separado.
1. En tu repositorio: **Settings › Secrets and variables › Actions › New repository secret**.
2. Crea `KEYSTORE_PASSWORD` y pega su valor.
3. Crea `KEYSTORE_BASE64` y pega su valor (es una línea muy larga, cópiala completa).

Esto hace que cada versión nueva se instale encima de la anterior sin borrar los datos de nadie.

## 3. Activa la versión para iPhone (1 min)
**Settings › Pages › Source:** elige **GitHub Actions**.

## 4. Sube los archivos (2 min)
1. Descomprime `CuentasClaras_proyecto.zip` en tu computadora.
2. En tu repositorio toca **uploading an existing file** (o **Add file › Upload files**).
3. Arrastra **todo el contenido** de la carpeta descomprimida, incluida la carpeta `.github`.
4. Toca **Commit changes**.

## 5. Espera a que se compile (5–10 min)
En la pestaña **Actions** verás dos procesos. Cuando tengan palomita verde:

- **APK para Android:** pestaña **Releases** › `CuentasClaras.apk`.
  Enlace fijo para compartir (siempre da la versión más nueva):
  `https://github.com/TU-USUARIO/cuentas-claras/releases/latest/download/CuentasClaras.apk`
- **iPhone:** `https://TU-USUARIO.github.io/cuentas-claras/`
  Se abre en Safari › botón Compartir › **Agregar a pantalla de inicio**.

Si alguien abre el enlace de iPhone desde un Android, la misma página le ofrece descargar el APK.

## Instalar el APK en Android
Al abrir el archivo, Android pedirá **permitir instalar apps de esta fuente**: acéptalo.
Play Protect puede advertir que la app es desconocida; es normal en apps fuera de Google Play.
Toca **Instalar de todas formas**.

## Actualizar la app
Cada vez que subas archivos nuevos al repositorio, se genera solo un APK nuevo en Releases
y se actualiza la versión de iPhone. Los usuarios instalan el APK encima y conservan sus datos.

## Si después quieres publicarla en las tiendas
- **Google Play:** pago único de $25 USD. Este mismo proyecto sirve.
- **App Store (iPhone):** $99 USD al año y se necesita una Mac para compilar.

## Privacidad
Los datos de cada persona se guardan solo en su teléfono. La app no tiene servidor ni cuentas,
así que no te cuesta nada mantenerla aunque la usen miles de personas.
Recomienda usar **Más › Respaldar datos** de vez en cuando.
