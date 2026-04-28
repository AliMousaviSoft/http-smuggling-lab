FROM debian:bullseye-slim
RUN echo "deb http://deb.debian.org/debian bullseye main" > /etc/apt/sources.list && \
    echo "deb http://security.debian.org/debian-security bullseye-security main" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y trafficserver && \
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /var/run/trafficserver && \
    chown -R nobody:nogroup /var/run/trafficserver && \
    chown -R nobody:nogroup /var/log/trafficserver && \
    chown -R nobody:nogroup /var/cache/trafficserver
COPY records.config /etc/trafficserver/records.config
COPY remap.config /etc/trafficserver/remap.config
EXPOSE 6100
CMD ["traffic_server"]
