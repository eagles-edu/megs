# ACME manual DNS renewal (acme.sh)

Manual DNS validation workflow for all eagles-related domains using `acme.sh`, ECC 256-bit keys, and nginx reload. The flow is two-step per domain: first get TXT values, then renew/install to `/etc/ssl/<domain>.*` with a reload.

## One-time prep

```bash
# ensure production CA
acme.sh --set-default-ca --server letsencrypt
```

## Per-domain workflow (manual DNS)

1) **Get TXT records** (prompts the `_acme-challenge` values; does not install):

```bash
acme.sh --issue \
  -d <root> -d <www-or-alt> \
  --keylength ec-256 \
  --dns \
  --yes-I-know-dns-manual-mode-enough-go-ahead-please \
  --dnssleep 120 \
  --server letsencrypt \
  --debug 2
```

- Publish both TXT records (`_acme-challenge.<root>` and `_acme-challenge.<www>`) and wait for DNS to propagate.

1) **Renew + install to nginx paths** (copies PEMs and reloads):

```bash
acme.sh --renew \
  -d <root> -d <www-or-alt> \
  --ecc \
  --server letsencrypt \
  --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 \
  --key-file /etc/ssl/<root>.key \
  --fullchain-file /etc/ssl/<root>.fullchain.cer \
  --cert-file /etc/ssl/<root>.cer \
  --ca-file /etc/ssl/<root>.ca.cer \
  --reloadcmd "systemctl reload nginx" \
  --force
```

## Domain command sets

### eagles.edu.vn + www

```bash
acme.sh --issue -d eagles.edu.vn -d www.eagles.edu.vn --keylength ec-256 --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --server letsencrypt --debug 2
acme.sh --renew -d eagles.edu.vn -d www.eagles.edu.vn --ecc --server letsencrypt --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --key-file /etc/ssl/eagles.edu.vn.key --fullchain-file /etc/ssl/eagles.edu.vn.fullchain.cer --cert-file /etc/ssl/eagles.edu.vn.cer --ca-file /etc/ssl/eagles.edu.vn.ca.cer --reloadcmd "systemctl reload nginx" --force
```

### eaglesvn.com + www

```bash
acme.sh --issue -d eaglesvn.com -d www.eaglesvn.com --keylength ec-256 --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --server letsencrypt --debug 2
acme.sh --renew -d eaglesvn.com -d www.eaglesvn.com --ecc --server letsencrypt --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --key-file /etc/ssl/eaglesvn.com.key --fullchain-file /etc/ssl/eaglesvn.com.fullchain.cer --cert-file /etc/ssl/eaglesvn.com.cer --ca-file /etc/ssl/eaglesvn.com.ca.cer --reloadcmd "systemctl reload nginx" --force
```

### eagles.vn + www

```bash
acme.sh --issue -d eagles.vn -d www.eagles.vn --keylength ec-256 --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --server letsencrypt --debug 2
acme.sh --renew -d eagles.vn -d www.eagles.vn --ecc --server letsencrypt --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --key-file /etc/ssl/eagles.vn.key --fullchain-file /etc/ssl/eagles.vn.fullchain.cer --cert-file /etc/ssl/eagles.vn.cer --ca-file /etc/ssl/eagles.vn.ca.cer --reloadcmd "systemctl reload nginx" --force
```

### eaglesvn.online + www

```bash
acme.sh --issue -d eaglesvn.online -d www.eaglesvn.online --keylength ec-256 --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --server letsencrypt --debug 2
acme.sh --renew -d eaglesvn.online -d www.eaglesvn.online --ecc --server letsencrypt --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --key-file /etc/ssl/eaglesvn.online.key --fullchain-file /etc/ssl/eaglesvn.online.fullchain.cer --cert-file /etc/ssl/eaglesvn.online.cer --ca-file /etc/ssl/eaglesvn.online.ca.cer --reloadcmd "systemctl reload nginx" --force
```

### gptpatient.com + www

```bash
acme.sh --issue -d gptpatient.com -d www.gptpatient.com --keylength ec-256 --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --server letsencrypt --debug 2
acme.sh --renew -d gptpatient.com -d www.gptpatient.com --ecc --server letsencrypt --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --key-file /etc/ssl/gptpatient.com.key --fullchain-file /etc/ssl/gptpatient.com.fullchain.cer --cert-file /etc/ssl/gptpatient.com.cer --ca-file /etc/ssl/gptpatient.com.ca.cer --reloadcmd "systemctl reload nginx" --force
```

### obgyn.gptpatient.com + www

```bash
acme.sh --issue -d obgyn.gptpatient.com -d www.obgyn.gptpatient.com --keylength ec-256 --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --server letsencrypt --debug 2
acme.sh --renew -d obgyn.gptpatient.com -d www.obgyn.gptpatient.com --ecc --server letsencrypt --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --key-file /etc/ssl/obgyn.gptpatient.com.key --fullchain-file /etc/ssl/obgyn.gptpatient.com.fullchain.cer --cert-file /etc/ssl/obgyn.gptpatient.com.cer --ca-file /etc/ssl/obgyn.gptpatient.com.ca.cer --reloadcmd "systemctl reload nginx" --force
```

### anhngu.eagles.edu.vn + www

```bash
acme.sh --issue -d anhngu.eagles.edu.vn -d www.anhngu.eagles.edu.vn --keylength ec-256 --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --server letsencrypt --debug 2
acme.sh --renew -d anhngu.eagles.edu.vn -d www.anhngu.eagles.edu.vn --ecc --server letsencrypt --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --key-file /etc/ssl/anhngu.eagles.edu.vn.key --fullchain-file /etc/ssl/anhngu.eagles.edu.vn.fullchain.cer --cert-file /etc/ssl/anhngu.eagles.edu.vn.cer --ca-file /etc/ssl/anhngu.eagles.edu.vn.ca.cer --reloadcmd "systemctl reload nginx" --force
```

### anhngu.eaglesvn.com + www

```bash
acme.sh --issue -d anhngu.eaglesvn.com -d www.anhngu.eaglesvn.com --keylength ec-256 --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --server letsencrypt --debug 2
acme.sh --renew -d anhngu.eaglesvn.com -d www.anhngu.eaglesvn.com --ecc --server letsencrypt --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --key-file /etc/ssl/anhngu.eaglesvn.com.key --fullchain-file /etc/ssl/anhngu.eaglesvn.com.fullchain.cer --cert-file /etc/ssl/anhngu.eaglesvn.com.cer --ca-file /etc/ssl/anhngu.eaglesvn.com.ca.cer --reloadcmd "systemctl reload nginx" --force
```

### thuvien.eagles.edu.vn + www

```bash
acme.sh --issue -d thuvien.eagles.edu.vn -d www.thuvien.eagles.edu.vn --keylength ec-256 --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --server letsencrypt --debug 2
acme.sh --renew -d thuvien.eagles.edu.vn -d www.thuvien.eagles.edu.vn --ecc --server letsencrypt --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --key-file /etc/ssl/thuvien.eagles.edu.vn.key --fullchain-file /etc/ssl/thuvien.eagles.edu.vn.fullchain.cer --cert-file /etc/ssl/thuvien.eagles.edu.vn.cer --ca-file /etc/ssl/thuvien.eagles.edu.vn.ca.cer --reloadcmd "systemctl reload nginx" --force
```

### thuvien.eaglesvn.com + www

```bash
acme.sh --issue -d thuvien.eaglesvn.com -d www.thuvien.eaglesvn.com --keylength ec-256 --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --server letsencrypt --debug 2
acme.sh --renew -d thuvien.eaglesvn.com -d www.thuvien.eaglesvn.com --ecc --server letsencrypt --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --dnssleep 120 --key-file /etc/ssl/thuvien.eaglesvn.com.key --fullchain-file /etc/ssl/thuvien.eaglesvn.com.fullchain.cer --cert-file /etc/ssl/thuvien.eaglesvn.com.cer --ca-file /etc/ssl/thuvien.eaglesvn.com.ca.cer --reloadcmd "systemctl reload nginx" --force
```

## Post-renew checks

- Confirm profile and timing:

```bash
acme.sh --info -d <root> | grep -E 'Le_API|Le_Alt|Le_NextRenewTimeStr'
```

- Confirm cert content:

```bash
openssl x509 -in /etc/ssl/<root>.fullchain.cer -noout -dates -issuer -subject -ext subjectAltName
```

- Spot-check live endpoint:

```bash
openssl s_client -connect <root>:443 -servername <root> </dev/null | openssl x509 -noout -dates -issuer -subject
curl -I http://<root>
```
