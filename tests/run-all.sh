#!/bin/sh
# Пересобирает игру и прогоняет все тесты. Запуск из корня: sh tests/run-all.sh
set -e
cd "$(dirname "$0")/.."
python3 build.py
mkdir -p shots
fail=0
for t in siegetest compat play qtest etest atest xptest v6test siegeui; do
  echo "== $t"
  out=$(node tests/$t.js 2>&1) || fail=1
  echo "$out" | tail -4
  echo "$out" | grep -q "FAIL\|PAGEERROR\|ПРОВАЛОВ" && fail=1
done
if [ $fail -ne 0 ]; then echo "ЕСТЬ ОШИБКИ"; exit 1; fi
echo "ВСЕ ТЕСТЫ ПРОШЛИ"
