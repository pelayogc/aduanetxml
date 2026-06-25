FROM eclipse-temurin:8-jre-jammy

ARG ADUANETXML_JAR_URL=https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/aduanetxml/aduanetxml_12_0.jar
ARG ADUANETXML_JAR_SHA256=3B9EFAAED10BCB4BEDBAD420F3406DE058305B29A75AFBF543FBF1C4FBF89A88

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xvfb \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/aduanetxml
RUN curl -fsSL "$ADUANETXML_JAR_URL" -o aduanetxml_12_0.jar \
  && echo "$ADUANETXML_JAR_SHA256  aduanetxml_12_0.jar" | sha256sum -c -

COPY entrypoint.sh /usr/local/bin/aduanetxml-entrypoint.sh
RUN chmod +x /usr/local/bin/aduanetxml-entrypoint.sh

WORKDIR /data
VOLUME ["/data/aduanetxml"]

ENTRYPOINT ["/usr/local/bin/aduanetxml-entrypoint.sh"]
