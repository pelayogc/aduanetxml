# AduanetXML Runner

Servicio Java aislado para ejecutar el JAR oficial de AEAT en Coolify.

## Volumen

Montar un volumen persistente en:

```text
/data/aduanetxml
```

La aplicacion Java crea y vigila:

```text
BandejaSalidaPrevioFirma
BandejaSalida
BandejaEntrada
Enviados
Rechazados
Logs
```

## Secretos requeridos

```text
ADUANETXML_CERT_PATH=/data/aduanetxml/micerti.pfx
ADUANETXML_CERT_PASSWORD=...
ADUANETXML_NIF=...
ADUANETXML_NOMBRE=...
ADUANETXML_HOST_SERVICIO_WEB=P
ADUANETXML_TIPO_RED=INTERNET
ADUANETXML_REQUIERE_BE=SI
```

`ADUANETXML_CERT_PASSWORD` se codifica en el entrypoint al formato esperado por `aduanetxml.properties`.

## Coolify

Crear un servicio Dockerfile apuntando a `runner/Dockerfile`, con el mismo volumen que la app Next usa para las carpetas AduanetXML.
