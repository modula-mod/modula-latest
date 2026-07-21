# Phase 6 PDS Go/No-Go
Date: 2026-07-17
Host: core.modula.digital

## `df -h`

```
Filesystem      Size  Used Avail Use% Mounted on
tmpfs           2.4G  2.2M  2.4G   1% /run
/dev/vda1       697G  244G  454G  35% /
tmpfs            12G  1.2M   12G   1% /dev/shm
tmpfs           5.0M     0  5.0M   0% /run/lock
/dev/vda16      881M  204M  616M  25% /boot
/dev/vda15      105M  6.2M   99M   6% /boot/efi
overlay         697G  244G  454G  35% /var/lib/docker/overlay2/b00c8755743340f804bb2f848da219ddb79d78ee9d6a255c17f86aa886b5e284/merged
overlay         697G  244G  454G  35% /var/lib/docker/overlay2/f8f8cc24b35ecfd5a8c8c5d7ea66faab7c7f3c836bec11ffece8dfaa0bf171bf/merged
overlay         697G  244G  454G  35% /var/lib/docker/overlay2/048e0a7dbe4df2f94611f5cc4dfc70a76c39197aba4de607fe2d5d715458f4bd/merged
overlay         697G  244G  454G  35% /var/lib/docker/overlay2/c7095d499456c24919a308b58b5f628a9fe06a67f993f91b268a9a31ad5d24b6/merged
overlay         697G  244G  454G  35% /var/lib/docker/overlay2/da090afa30db4eb1a79454c9bfe11c10932c8fb6b6a5fb7adc8bec56c06a8647/merged
overlay         697G  244G  454G  35% /var/lib/docker/overlay2/01e621c200d9ccacb1c309412374261b03488f0e126d4886fe33c4070dce883f/merged
overlay         697G  244G  454G  35% /var/lib/docker/overlay2/1f5c40159a58f623a67e4069d43b050acbff30b6e5a2df30e677c0d2e608d38b/merged
overlay         697G  244G  454G  35% /var/lib/docker/overlay2/500d0d28782c6c7f032fcf191b9bd2d63e6526c4bd5651c5c775299cbfab78be/merged
tmpfs           2.4G   48K  2.4G   1% /run/user/0
overlay         697G  244G  454G  35% /var/lib/docker/overlay2/1d35eb4d296ae27c5b01f451651a255a9c80f154551ee39fc1b7265c278b65c8/merged
```

## `free -h`

```
total        used        free      shared  buff/cache   available
Mem:            23Gi       4.9Gi       6.7Gi        36Mi        12Gi        18Gi
Swap:          4.0Gi       1.8Gi       2.2Gi
```

## `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`

```
NAMES                       STATUS                  PORTS
modula-preview-postgres-1   Up 22 hours (healthy)   127.0.0.1:5433->5432/tcp
LibreChat                   Up 9 days               127.0.0.1:3080->3080/tcp
chat-mongodb                Up 9 days               27017/tcp
chat-meilisearch            Up 9 days               7700/tcp
rag_api                     Up 9 days               
vectordb                    Up 9 days               5432/tcp
nodus                       Up 9 days (healthy)     127.0.0.1:3011->3001/tcp
open-webui                  Up 9 days (healthy)     0.0.0.0:3000->8080/tcp, [::]:3000->8080/tcp
modula-keycloak-db          Up 9 days (healthy)     5432/tcp
```

## `docker network ls`

```
NETWORK ID     NAME                             DRIVER    SCOPE
20ae8fe7435a   bridge                           bridge    local
e309755df48e   host                             host      local
cbd3d8fd0167   librechat_default                bridge    local
a1e3ff68f047   modula-preview_modula_internal   bridge    local
c049b60838cb   modula-sso_keycloak-network      bridge    local
2f2fa9c5eab5   nodus_nodus-network              bridge    local
f52f74276cb4   none                             null      local
f378ed0db1d9   open-webui-frontend_default      bridge    local
66318abe0b96   runtime_default                  bridge    local
```

## Listening sockets (ss)

```
Netid State  Recv-Q Send-Q                               Local Address:Port  Peer Address:PortProcess                                                                                                                                                                                                                                                                                                                                                                          
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=776))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=286))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=775))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=291))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=774))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=773))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=485))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=293))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=289))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=772))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=771))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.23.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=484))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=464))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=470))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=471))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=468))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=466))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=462))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=465))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=469))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=463))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=467))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=461))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.20.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=460))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=446))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=447))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=440))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=441))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=443))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=442))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=438))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=445))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=444))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=436))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=439))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.21.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=437))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=418))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=423))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=417))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=420))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=422))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=421))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=415))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=419))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=414))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=413))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=416))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.17.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=412))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=398))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=399))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=396))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=392))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=393))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=390))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=397))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=395))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=391))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=394))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=389))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.18.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=388))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=368))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=373))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=372))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=366))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=374))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=375))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=369))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=371))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=370))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=367))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=365))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.22.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=364))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.19.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=346))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.19.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=344))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.19.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=342))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.19.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=343))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.19.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=350))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.19.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=351))                                                                                                                                                                                                                                                                                                                                               
udp   UNCONN 0      0                                       172.19.0.1:53         0.0.0.0:*    users:(("named",pid=1114,fd=349))
```

## nginx -T (truncated)

```
nginx: [warn] "ssl_stapling" ignored, no OCSP responder URL in the certificate "/home/andrei/conf/web/modula.digital/ssl/modula.digital.pem"
nginx: [warn] "ssl_stapling" ignored, no OCSP responder URL in the certificate "/home/andrei/conf/web/nodus.modula.digital/ssl/nodus.modula.digital.pem"
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
# configuration file /etc/nginx/nginx.conf:
# Server globals
user                 www-data;
worker_processes     auto;
worker_rlimit_nofile 65535;
error_log            /var/log/nginx/error.log;
pid                  /run/nginx.pid;
include              /etc/nginx/conf.d/main/*.conf;
include              /etc/nginx/modules-enabled/*.conf;

# Worker config
events {
	worker_connections 1024;
	use                epoll;
	multi_accept       on;
}

http {
	# Main settings
	sendfile                        on;
	tcp_nopush                      on;
	tcp_nodelay                     on;
	client_header_timeout           180s;
	client_body_timeout             180s;
	client_header_buffer_size       2k;
	client_body_buffer_size         256k;
	client_max_body_size            1024m;
	large_client_header_buffers     4 8k;
	send_timeout                    60s;
	keepalive_timeout               30s;
	keepalive_requests              1000;
	reset_timedout_connection       on;
	server_tokens                   off;
	server_name_in_redirect         off;
	server_names_hash_max_size      512;
	server_names_hash_bucket_size   512;
	charset                         utf-8;
	# FastCGI settings
	fastcgi_buffers                 512 4k;
	fastcgi_buffer_size             256k;
	fastcgi_busy_buffers_size       256k;
	fastcgi_temp_file_write_size    256k;
	fastcgi_connect_timeout         30s;
	fastcgi_read_timeout            300s;
	fastcgi_send_timeout            180s;
	fastcgi_cache_lock              on;
	fastcgi_cache_lock_timeout      5s;
	fastcgi_cache_background_update on;
	fastcgi_cache_revalidate        on;
	# Proxy settings
	proxy_redirect                  off;
	proxy_set_header                Host $host;
	proxy_set_header                Early-Data $rfc_early_data;
	proxy_set_header                X-Real-IP $remote_addr;
	proxy_set_header                X-Forwarded-For $proxy_add_x_forwarded_for;
	proxy_pass_header               Set-Cookie;
	proxy_buffers                   256 4k;
	proxy_buffer_size               32k;
	proxy_busy_buffers_size         32k;
	proxy_temp_file_write_size      256k;
	proxy_connect_timeout           30s;
	proxy_read_timeout              300s;
	proxy_send_timeout              180s;
	# Log format
	log_format                      main '$remote_addr - $remote_user [$time_local] $request "$status" $body_bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for"';
	log_format                      bytes '$body_bytes_sent';
	log_not_found                   off;
	access_log                      off;
	# Mime settings
	include                         /etc/nginx/mime.types;
	default_type                    application/octet-stream;
	# Compression
	gzip                            on;
	gzip_vary                       on;
	gzip_static                     on;
	gzip_comp_level                 6;
	gzip_min_length                 1024;
	gzip_buffers                    128 4k;
	gzip_http_version               1.1;
	gzip_types                      text/css text/javascript text/js text/plain text/richtext text/shtml text/x-component text/x-java-source text/x-markdown text/x-script text/xml image/bmp image/svg+xml image/vnd.microsoft.icon image/x-icon font/otf font/ttf font/x-woff multipart/bag multipart/mixed application/eot application/font application/font-sfnt application/font-woff application/javascript application/javascript-binast application/json application/ld+json application/manifest+json application/opentype application/otf application/rss+xml application/ttf application/truetype application/vnd.api+json application/vnd.ms-fontobject application/wasm application/xhtml+xml application/xml application/xml+rss application/x-httpd-cgi application/x-javascript application/x-opentype application/x-otf application/x-perl application/x-protobuf application/x-ttf;
	gzip_proxied                    any;
	# Cloudflare IPs
	include                         /etc/nginx/conf.d/cloudflare.inc;
	# SSL PCI compliance
	ssl_buffer_size                 1369;
	ssl_ciphers                     "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-SHA256";
	ssl_dhparam                     /etc/ssl/dhparam.pem;
	ssl_early_data                  on;
	ssl_ecdh_curve                  auto;
	ssl_prefer_server_ciphers       on;
	ssl_protocols                   TLSv1.2 TLSv1.3;
	ssl_session_cache               shared:SSL:20m;
	ssl_session_tickets             on;
	ssl_session_timeout             7d;
	resolver                        127.0.0.53 valid=300s ipv6=off;
	resolver_timeout                5s;
```

## Evaluation

| Check | Result |
|-------|--------|
| Shared Hestia/Nginx host | Yes — production `modula.digital` / `api.modula.digital` |
| Ports 80/443 | Already serving primary web/API |
| Wildcard DNS/TLS for `*.pds.modula.digital` | Not verified as ready |
| Docker resources | Available, but PDS would share the host |
| Backup isolation | Not yet dedicated for PDS blobs/repo |
| Security boundary | Risk of Hestia overwrite / port conflict |

## Verdict

**PDS deployment: DEFERRED**

Reason: shared Hestia/Nginx VPS already terminates TLS for primary Modula properties; running the official PDS installer or a live PDS on this host risks destabilising `modula.digital` / `api.modula.digital`.

Deployment-ready configuration: **completed** under `ops/atproto/pds/`.
