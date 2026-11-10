#!/bin/bash
# Menyiapkan database MySQL untuk FinSense.
#
# Password diminta secara interaktif dan tidak pernah muncul di layar, di
# riwayat shell, maupun di argumen proses. Skrip ini menuliskannya hanya ke
# backend/.env, yang sudah masuk .gitignore.
#
# Pakai:  bash scripts/setup-db.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
DB_NAME="finsense_db"
DB_USER="root"

[ -f "$ENV_FILE" ] || { echo "Tidak menemukan $ENV_FILE"; exit 1; }

printf 'Password MySQL untuk user %s: ' "$DB_USER"
stty -echo; IFS= read -r DB_PASS; stty echo; printf '\n'

export MYSQL_PWD="$DB_PASS"

echo "-> Menguji koneksi ke MySQL..."
if ! mysql -u "$DB_USER" --connect-timeout=5 -e "SELECT 1" >/dev/null 2>&1; then
  echo "Koneksi gagal. Password salah, atau MySQL tidak berjalan di 127.0.0.1:3306."
  exit 1
fi
echo "   koneksi berhasil."

echo "-> Membuat database '$DB_NAME' bila belum ada..."
mysql -u "$DB_USER" -e \
  "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "-> Menulis kredensial ke backend/.env..."
DB_PASS="$DB_PASS" DB_USER="$DB_USER" DB_NAME="$DB_NAME" ENV_FILE="$ENV_FILE" python3 <<'PY'
import io, os, re
from urllib.parse import quote

env_file = os.environ['ENV_FILE']
pw, user, name = os.environ['DB_PASS'], os.environ['DB_USER'], os.environ['DB_NAME']
url = f"mysql://{quote(user, safe='')}:{quote(pw, safe='')}@localhost:3306/{name}"

s = io.open(env_file, encoding='utf-8').read()
s = re.sub(r'^DATABASE_URL=.*$', 'DATABASE_URL=' + url, s, count=1, flags=re.M)
s = re.sub(r'^DB_PASSWORD=.*$', 'DB_PASSWORD=' + pw, s, count=1, flags=re.M)
s = re.sub(r'^# ISI DUA BARIS.*\n', '', s, count=1, flags=re.M)
io.open(env_file, 'w', encoding='utf-8').write(s)
print("   .env diperbarui (DATABASE_URL dan DB_PASSWORD).")
PY

chmod 600 "$ENV_FILE"
unset MYSQL_PWD

echo "-> Menjalankan migrasi Prisma..."
cd "$ROOT/backend"
npx prisma migrate deploy

echo "-> Membuat ulang Prisma Client..."
npx prisma generate

echo
echo "Selesai. Database '$DB_NAME' siap."
echo "Restart backend agar .env yang baru terbaca."
