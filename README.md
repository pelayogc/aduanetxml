# AduanetXML

Aplicacion interna para crear expedientes aduaneros desde facturas NA de NAV 2013,
preparar documentacion aduanera, depositar XML en AduanetXML y seguir el ciclo
completo hasta recuperar evidencias de AEAT.

La web es la interfaz operativa. El envio, firma y recepcion se delegan en el
programa oficial AduanetXML de AEAT, ejecutado como servicio Java aislado.

## Estado actual

- Lee facturas de NAV SQL Server en modo solo lectura.
- Crea expedientes idempotentes `EXP-NA-{anio}-{factura}`.
- Extrae datos aduaneros desde lineas de factura y lineas descriptivas.
- Muestra pendientes de validacion con errores claros.
- Genera documentos internos y XML versionado.
- Deposita XML en carpetas oficiales de AduanetXML.
- Sincroniza enviados, rechazados, respuestas y logs.
- Archiva evidencias descargables desde la web.

Importante: el XML de procedimiento AEAT sigue siendo una plantilla stub en este
hito. Antes de envio real en produccion hay que sustituirlo por el XML validado
contra el XSD/procedimiento AEAT correspondiente.

## Arquitectura

Componentes principales:

- `aduanetxml-web`: Next.js + TypeScript. Interfaz, APIs internas y sincronizador.
- PostgreSQL: base de datos de expedientes, documentos, estados y auditoria.
- Prisma: modelo de datos y acceso a PostgreSQL.
- NAV SQL Server: origen de facturas. Solo se usan consultas `SELECT`
  parametrizadas con usuario de lectura.
- `aduanetxml-runner`: contenedor Java 8 + Xvfb que ejecuta el JAR oficial
  AduanetXML.
- Volumen compartido: carpetas oficiales de intercambio entre la web y el JAR.

Flujo resumido:

```text
NAV factura NA
  -> web crea expediente
  -> operador valida/completa datos
  -> web genera documentos y XML versionado
  -> web deposita XML en BandejaSalidaPrevioFirma
  -> runner Java firma/envia/recibe mediante AduanetXML
  -> web sincroniza carpetas y archiva evidencias
  -> operador descarga respuestas, justificantes y levantes
```

## Requisitos locales

- Windows con PowerShell.
- Node.js compatible con el proyecto.
- `npm`.
- Acceso a PostgreSQL.
- Acceso de red al SQL Server de NAV.
- Docker Desktop solo si se quiere validar contenedores localmente.

Para produccion en Coolify se necesita ademas:

- Proyecto Coolify.
- Aplicacion web `aduanetxml-web`.
- Servicio Java `aduanetxml-runner`.
- PostgreSQL asociado.
- Volumen persistente compartido.
- Certificado PFX de AEAT montado como secreto o volumen.
- Variables secretas configuradas en Coolify.

## Configuracion de entorno

Copiar `.env.example` a `.env.local` y completar los secretos:

```powershell
Copy-Item .env.example .env.local
```

Variables principales:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

NAV_SQLSERVER_HOST=10.164.14.9
NAV_SQLSERVER_PORT=1433
NAV_SQLSERVER_DATABASE=PARANINFO_2013
NAV_SQLSERVER_USER=reader
NAV_SQLSERVER_PASSWORD=
NAV_SQLSERVER_COMPANY=ITES_EU

DOCUMENT_STORAGE_ROOT=./storage/documents

ADUANETXML_OUTBOX=./storage/aduanetxml/BandejaSalidaPrevioFirma
ADUANETXML_SEND_OUTBOX=./storage/aduanetxml/BandejaSalida
ADUANETXML_SENT=./storage/aduanetxml/Enviados
ADUANETXML_REJECTED=./storage/aduanetxml/Rechazados
ADUANETXML_INBOX=./storage/aduanetxml/BandejaEntrada
ADUANETXML_ERRORS=./storage/aduanetxml/errors
ADUANETXML_PROCESSED=./storage/aduanetxml/processed
ADUANETXML_LOGS=./storage/aduanetxml/Logs

INTERNAL_JOB_TOKEN=
INTERNAL_BASE_URL=https://intranet.paraninfo.es/aduanas
```

Reglas:

- No commitear `.env.local`, certificados, passwords ni XML reales con datos
  sensibles.
- `NAV_SQLSERVER_COMPANY` debe coincidir con una empresa permitida. La app
  valida el nombre para evitar inyeccion en nombres de tabla NAV.
- El usuario NAV debe ser de solo lectura.
- `INTERNAL_JOB_TOKEN` protege endpoints de sincronizacion usados por jobs.

## Instalacion local

```powershell
npm install
npx prisma generate
npx prisma db push
npm run check
npm run lint
npm run test
npm run build
```

Arranque local:

```powershell
npm run dev -- -p 3005
```

Abrir:

```text
http://localhost:3005
```

## Uso operativo

### 1. Buscar factura

En la pantalla principal introducir el numero de factura NAV, por ejemplo una
factura NA. La web llama a:

```http
GET /api/nav/invoices?documentNo=NA-0000000
```

La consulta lee:

- Cabecera de factura.
- Lineas de factura.
- Cliente.
- Articulos.
- Columnas opcionales detectadas en `sys.columns`.

Si NAV no responde, falta configuracion o la factura no existe, la web debe
mostrar el error de forma visible.

### 2. Crear expediente

Accion:

```http
POST /api/customs-files/from-invoice
```

La creacion es idempotente. Para la misma factura debe reutilizar el expediente
existente y no duplicarlo.

Identificador esperado:

```text
EXP-NA-{anio}-{factura}
```

### 3. Revisar datos importados

La app intenta extraer:

- Datos de cliente.
- Pais, provincia, codigo postal y ciudad.
- Lineas de mercancia.
- Bultos.
- Peso neto y bruto.
- Aduana textual.
- Partida/codigo de mercancia.
- Indicadores como `T2LF` o soporte magnetico.

La linea aduanera no depende solo del tipo NAV. Se concatenan descripciones de
lineas no mercancancia y se detectan terminos como:

- `BULTOS`
- `PESO`
- `ADUANA`
- `PARTIDA`
- `T2LF`
- `SOPORTE MAGNETICO`

### 4. Completar campos pendientes

Los campos tienen ayuda contextual con icono `?`.

Campos vinculados:

- Aduana y codigo AEAT de aduana.
- Codigo de mercancia y descripcion.

Cuando un campo es maestro, debe operar como desplegable y el campo dependiente
debe reflejar la relacion. Esto evita teclear codigos incompatibles.

### 5. Validar expediente

Accion:

```http
POST /api/customs-files/:id/validate
```

La validacion detecta, entre otros:

- Canarias sin `T2LF` cuando aplique.
- Ceuta/Melilla con codigos de pais/provincia esperados.
- Aduana no reconocida.
- Peso bruto menor que peso neto.
- Expediente sin lineas de libro/mercancia.
- Datos obligatorios incompletos.

Los pendientes se muestran en pantalla y bloquean el avance cuando son criticos.

### 6. Generar documentos

Accion:

```http
POST /api/customs-files/:id/documents
```

Genera documentos internos y registra metadatos en base de datos. Los ficheros
se guardan bajo `DOCUMENT_STORAGE_ROOT`.

### 7. Generar XML

Accion:

```http
POST /api/customs-files/:id/xml
```

Reglas:

- No sobrescribir XML anteriores.
- Usar versionado por expediente y procedimiento.
- Registrar documento `XML_GENERADO`.
- Si hay cambios posteriores, marcar el expediente como pendiente de regenerar.

Patron recomendado:

```text
{expediente}_{procedimiento}_v{n}.xml
```

### 8. Enviar a AduanetXML

Accion:

```http
POST /api/customs-files/:id/send-to-aduanetxml
```

La web copia el XML generado a `BandejaSalidaPrevioFirma` y marca el expediente
como `PENDIENTE_FIRMA_ENVIO`. Tambien archiva una evidencia `XML_DEPOSITADO`.

El envio real lo realiza el programa oficial AduanetXML en el servicio Java.

### 9. Monitorizar

Pantalla:

```text
/aduanetxml
```

Muestra:

- Cola pendiente.
- Expedientes en proceso.
- Enviados.
- Rechazados.
- Respuestas sin asociar.
- Ultimos logs.
- Boton `Sincronizar ahora`.

Sincronizacion manual:

```http
POST /api/aduanetxml/sync
Authorization: Bearer {INTERNAL_JOB_TOKEN}
```

Tambien existe compatibilidad con:

```http
POST /api/aduanetxml/process-responses
```

## Estados de AduanetXML

Estados operativos principales:

- `PENDIENTE_FIRMA_ENVIO`: XML depositado para que el JAR lo procese.
- `EN_PROCESO_ADUANETXML`: el fichero esta en cola o en transito.
- `FIRMADO_ENVIADO`: AduanetXML lo ha movido a enviados.
- `RECHAZADO_ADUANETXML`: AduanetXML lo ha rechazado antes o durante envio.
- `RESPUESTA_RECIBIDA`: hay respuesta AEAT asociada.
- `ADMITIDO`: la respuesta indica admision.
- `LEVANTE_OBTENIDO`: se ha recuperado levante.
- `ERROR_AEAT`: la respuesta contiene error AEAT.

Documentos recuperables:

- `XML_GENERADO`
- `XML_DEPOSITADO`
- `XML_FIRMADO_ENVIADO`
- `XML_RECHAZADO`
- `XML_RESPUESTA_AEAT`
- `JUSTIFICANTE_AEAT`
- `LEVANTE_AEAT`
- `LOG_ADUANETXML`

Descarga segura:

```http
GET /api/customs-files/:id/documents/:documentId/download
```

La descarga valida que el documento pertenece al expediente indicado.

## Carpetas oficiales

Raiz recomendada:

```text
/data/aduanetxml
```

Estructura:

```text
/data/aduanetxml/
  BandejaSalidaPrevioFirma/
  BandejaSalida/
  Enviados/
  Rechazados/
  BandejaEntrada/
  Logs/
```

Significado:

- `BandejaSalidaPrevioFirma`: la web deposita XML pendientes de firma/envio.
- `BandejaSalida`: AduanetXML mantiene ficheros en proceso.
- `Enviados`: AduanetXML deja XML firmados/enviados.
- `Rechazados`: AduanetXML deja rechazos.
- `BandejaEntrada`: respuestas de AEAT, justificantes y levantes.
- `Logs`: logs del runner oficial.

El sincronizador de la web recorre estas carpetas, registra documentos y mueve
el estado del expediente.

## Runner Java AduanetXML

El runner esta en:

```text
runner/
```

Ficheros relevantes:

- `runner/Dockerfile`
- `runner/entrypoint.sh`
- `runner/README.md`

El contenedor usa:

- Java 8.
- Xvfb, porque el programa oficial puede necesitar entorno grafico.
- JAR oficial descargado desde AEAT.
- Volumen persistente `/data/aduanetxml`.

Variables del runner:

```env
ADUANETXML_WORKDIR=/data/aduanetxml
ADUANETXML_CERT_PATH=/run/secrets/aeat-cert.pfx
ADUANETXML_CERT_PASSWORD=
ADUANETXML_NIF=
ADUANETXML_NOMBRE=
ADUANETXML_HOST_SERVICIO_WEB=P
ADUANETXML_TIPO_RED=INTERNET
ADUANETXML_REQUIERE_BE=SI
```

Reglas:

- El PFX nunca se guarda en Git.
- La password del certificado va como secreto.
- El volumen debe sobrevivir reinicios.
- El runner puede reiniciarse sin perder cola ni evidencias si el volumen es
  persistente.

## Coolify

Coolify esta en:

```text
http://10.164.18.45:8000/
```

Servicios esperados:

- `aduanetxml-web`: Next.js.
- `aduanetxml-runner`: Java 8 + Xvfb + JAR oficial.
- `aduanetxml-postgres`: PostgreSQL.

Compose de referencia:

```text
docker-compose.coolify.yml
```

Configuracion a verificar antes de desplegar:

- Proyecto Coolify correcto.
- Entorno correcto.
- Repositorio Git correcto.
- Rama correcta.
- `fqdn` de la web.
- Puerto expuesto.
- Variables de entorno.
- Secretos.
- Volumen compartido.
- Base de datos asociada.
- Healthcheck.
- Ruta de healthcheck: `/healthz`.

Job recomendado cada 5 minutos:

```http
POST https://aduanetxml.nobel.es/api/aduanetxml/sync
Authorization: Bearer {INTERNAL_JOB_TOKEN}
```

Si `aduanetxml.nobel.es` no resuelve DNS, primero corregir DNS/tunel antes de
diagnosticar Next.js o Coolify.

## Endpoints internos

```http
GET  /api/nav/invoices?documentNo=...
POST /api/customs-files/from-invoice
GET  /api/customs-files/:id
PATCH /api/customs-files/:id
POST /api/customs-files/:id/validate
POST /api/customs-files/:id/documents
POST /api/customs-files/:id/xml
POST /api/customs-files/:id/send-to-aduanetxml
POST /api/aduanetxml/sync
POST /api/aduanetxml/process-responses
GET  /api/customs-files/:id/documents/:documentId/download
GET  /healthz
```

## Modelo de datos

Entidades principales:

- `CustomsFile`: expediente aduanero.
- `CustomsFileLine`: lineas de mercancia.
- `CustomsDocument`: documentos y evidencias.
- `CustomsXmlSubmission`: envios XML versionados.
- `CustomsAuditLog`: auditoria append-only.
- `CustomsOffice`: maestras de aduanas.
- `TariffMapping`: relacion codigo mercancia/descripcion.
- `ProcedureRule`: reglas por procedimiento.
- `Carrier`: transportistas.
- `AppSetting`: configuracion.
- `User`: usuarios.

La auditoria no debe reescribirse. Cada cambio relevante se anade como evento.

## Validacion y pruebas

Comandos habituales:

```powershell
npm run check
npm run lint
npm run test
npm run build
```

Smoke local:

```powershell
curl.exe -i http://localhost:3005/
curl.exe -i http://localhost:3005/aduanetxml
curl.exe -i -X POST http://localhost:3005/api/aduanetxml/sync -H "Authorization: Bearer $env:INTERNAL_JOB_TOKEN"
```

Pruebas esperadas:

- Parser aduanero: decimales con coma/punto, tildes, saltos, `T2LF`, pesos
  invalidos.
- Validacion: Canarias, Ceuta/Melilla, aduana, pesos, lineas de mercancia.
- NAV mock: consulta parametrizada, empresa escapada, timeouts, factura
  inexistente.
- Prisma: idempotencia, auditoria append-only, XML versionado.
- UI: buscar factura, crear expediente, ver pendientes, completar datos,
  validar, generar XML y depositarlo.

## Diagnostico

### Falta `DATABASE_URL`

Error tipico:

```text
Environment variable not found: DATABASE_URL
```

Prisma CLI lee `.env` de forma nativa, pero no siempre carga `.env.local` al
ejecutar comandos directos. Opciones:

- Exportar `DATABASE_URL` en la sesion PowerShell.
- Crear `.env` local no commiteado si se necesita para CLI.
- Usar scripts del proyecto que carguen entorno.

La URL debe empezar literalmente por `postgresql://` o `postgres://`.

### Prisma no regenera cliente

Si hay errores de bloqueo de ficheros o `EPERM`, cerrar el servidor Next.js y
volver a ejecutar:

```powershell
npx prisma generate
```

### NAV no devuelve actividad

Comprobar:

- Variables `NAV_SQLSERVER_*`.
- Red hacia `10.164.14.9:1433`.
- Password del usuario `reader`.
- Empresa NAV `ITES_EU`.
- Que el numero de factura existe exactamente como `No_`.
- Logs de la API `GET /api/nav/invoices`.

Los errores deben mostrarse en pantalla, no quedar silenciosos.

### Docker local falla

Si aparece un error contra `dockerDesktopLinuxEngine`, Docker Desktop no esta
arrancado en Windows. Validar en Coolify o arrancar Docker Desktop antes de
concluir que el Dockerfile falla.

### Dominio no carga

Para `aduanetxml.nobel.es` revisar por capas:

- DNS.
- Regla de Cloudflare Tunnel.
- Politica Cloudflare Access.
- Configuracion Coolify (`fqdn`, puerto, rama, logs).
- Healthcheck y logs de contenedor.

Si DNS no resuelve desde la maquina local, no es todavia un problema de Next.js.

## Seguridad

- No commitear credenciales.
- No commitear certificados.
- No commitear documentos reales con datos personales o fiscales.
- NAV se usa con usuario de lectura.
- Todas las consultas NAV deben ser parametrizadas.
- Los nombres de empresa NAV se validan estrictamente.
- Los endpoints internos programados deben usar `INTERNAL_JOB_TOKEN`.
- Las descargas de documentos deben validar pertenencia a expediente.
- El PFX AEAT se monta como secreto o volumen en Coolify.

## Git y despliegue

Repositorio remoto:

```text
https://github.com/pelayogc/aduanetxml.git
```

Flujo recomendado:

```powershell
git status --short --branch
npm run check
npm run lint
npm run test
npm run build
git add <archivos-propios>
git diff --cached
git commit -m "..."
git push origin <rama>
```

Despues del push, desplegar en Coolify solo si se ha verificado:

- El commit que se va a desplegar.
- La rama configurada en Coolify.
- Que no hay cambios locales propios sin commitear.
- Que no se han incluido cambios ajenos accidentalmente.

## Limites conocidos

- XML AEAT real pendiente de sustituir por plantilla/procedimiento definitivo.
- Envio real depende del JAR oficial, certificado AEAT y configuracion de
  AduanetXML.
- La recuperacion de justificantes/levantes depende de los nombres y formatos
  reales que deje AduanetXML en `BandejaEntrada`.
- La aplicacion web de Coolify puede no existir aun aunque exista el proyecto y
  la base de datos.
