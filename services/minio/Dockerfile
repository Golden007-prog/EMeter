# Build the pinned community source; do not depend on discontinued registry images.
FROM golang:1.24.2-alpine AS build
RUN apk add --no-cache git
WORKDIR /src
RUN git clone --depth 1 --branch RELEASE.2025-04-22T22-12-26Z https://github.com/minio/minio.git .
RUN CGO_ENABLED=0 go build -trimpath -o /minio .
FROM alpine:3.22
RUN apk add --no-cache ca-certificates curl
COPY --from=build /minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /usr/share/licenses/minio/LICENSE
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
