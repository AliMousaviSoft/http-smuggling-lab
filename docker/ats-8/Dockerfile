FROM debian:bullseye-slim
RUN echo "deb http://deb.debian.org/debian bullseye main" > /etc/apt/sources.list && \
    echo "deb http://security.debian.org/debian-security bullseye-security main" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y trafficserver openssl && \
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /var/run/trafficserver && \
    chown -R nobody:nogroup /var/run/trafficserver && \
    chown -R nobody:nogroup /var/log/trafficserver && \
    chown -R nobody:nogroup /var/cache/trafficserver
RUN openssl req -x509 -newkey rsa:2048 \
    -keyout /etc/trafficserver/server.key \
    -out /etc/trafficserver/server.crt \
    -days 365 -nodes -subj "/CN=localhost" && \
    chown nobody:nogroup /etc/trafficserver/server.key \
                         /etc/trafficserver/server.crt
COPY records.config /etc/trafficserver/records.config
COPY remap.config /etc/trafficserver/remap.config
COPY ssl_multicert.config /etc/trafficserver/ssl_multicert.config
EXPOSE 6100
CMD ["traffic_server"]
