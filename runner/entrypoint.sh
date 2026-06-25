#!/usr/bin/env sh
set -eu

WORKDIR="${ADUANETXML_WORKDIR:-/data/aduanetxml}"
CERT_PATH="${ADUANETXML_CERT_PATH:-$WORKDIR/micerti.pfx}"
CERT_PASSWORD="${ADUANETXML_CERT_PASSWORD:-}"
NIF="${ADUANETXML_NIF:-}"
NOMBRE="${ADUANETXML_NOMBRE:-}"
HOST="${ADUANETXML_HOST_SERVICIO_WEB:-P}"
TIPO_RED="${ADUANETXML_TIPO_RED:-INTERNET}"
REQUIERE_BE="${ADUANETXML_REQUIERE_BE:-SI}"
DEBUG="${ADUANETXML_DEBUG:-3}"

mkdir -p \
  "$WORKDIR/BandejaSalidaPrevioFirma" \
  "$WORKDIR/BandejaSalida/Reenviables" \
  "$WORKDIR/BandejaEntrada/RespuestasPdtes" \
  "$WORKDIR/Enviados" \
  "$WORKDIR/Rechazados" \
  "$WORKDIR/Logs"

if [ -z "$CERT_PASSWORD" ]; then
  echo "ADUANETXML_CERT_PASSWORD is required" >&2
  exit 1
fi

if [ -z "$NIF" ] || [ -z "$NOMBRE" ]; then
  echo "ADUANETXML_NIF and ADUANETXML_NOMBRE are required" >&2
  exit 1
fi

if [ ! -f "$CERT_PATH" ]; then
  echo "Certificate file not found at $CERT_PATH" >&2
  exit 1
fi

ENCODED_PASSWORD="$(printf '%s' "$CERT_PASSWORD" | base64 | tr -d '\n' | rev)"

cat > "$WORKDIR/aduanetxml.properties" <<EOF
ficKeyStore=$CERT_PATH
keyStorePassword=$ENCODED_PASSWORD
httpsProxyHost=${ADUANETXML_HTTPS_PROXY_HOST:-}
httpsProxyPort=${ADUANETXML_HTTPS_PROXY_PORT:-}
httpsProxyUser=${ADUANETXML_HTTPS_PROXY_USER:-}
httpsProxyPassword=${ADUANETXML_HTTPS_PROXY_PASSWORD:-}
debug=$DEBUG
nif=$NIF
nombre=$NOMBRE
hostServicioWeb=$HOST
tipoRed=$TIPO_RED
requiereBE=$REQUIERE_BE
esquemaPeticion=${ADUANETXML_ESQUEMA_PETICION:-}
EOF

cd /data
exec xvfb-run -a java -Djava.awt.headless=false -jar /opt/aduanetxml/aduanetxml_12_0.jar
