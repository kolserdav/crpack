# Create package


A command line utility that runs the Node.js package as a systemd service via Nginx with a Let's Encrypt certificate.   


## Requirements

System:

```
linux + systemd
```

Dependencies:

```d
node           // >=15.0.0 (used AbortController)
nginx          // latest (for set multi domains)
certbot        // latest (for --ssl option)
cron           // any (for --git option)
curl           // any for --git option)
```

Additionals:

```d
domain name // with A record that value is IP of target mashine
```

## Instalation

```
npm i -g crpack
```

## Run

```
sudo crpack run
```

## Examples

### With ssl

```
sudo crpack run --ssl
```

### With app port

```
sudo crpack run --port 3001
```

### Help

```
crpack -h
```

# Other

_If you encounter problems please post a issue describing the problem._
