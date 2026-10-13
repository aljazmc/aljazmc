#!/bin/bash

## Variables

#PROJECT_NAME=`echo ${PWD##*/}` ## PROJECT_NAME = parent directory
PROJECT_UID=$(id -u)
PROJECT_GID=$(id -g)

## Functions

clean() {

    docker compose down -v --rmi all --remove-orphans
    rm -rf \
        .cache \
        .node_repl_history \
        .npm \
        .yarn/berry \
        .yarn/bin \
        .yarn/cache \
        .yarn/sdks \
        .yarn/unplugged \
        coverage \
        node_modules \
        packages/*/bin

    ## keep .yarn/releases/yarn-*.cjs

    find . -type f -not -path "./.git/*" \( \
        -name "*.d.ts" \
        -o -name "*.js" \
        -o -name "*.jsx" \
        -o -name "*.mjs" \
        -o -name "*.tsbuildinfo" \
        -o -name ".pnp.cjs" \
        -o -name "docker-compose.yml" \
        -o -name "install-state.gz" \
        \) -delete

}

compose() {

if [[ ! -f docker-compose.yml ]]; then
    cat << EOF > docker-compose.yml
services:
    node:
        image: aljazmc/corepack-alpine
        working_dir: $PWD
        volumes:
            - .:$PWD
        environment:
            HOME:               $PWD
            NODE_AUTH_TOKEN:    \${NODE_AUTH_TOKEN:-}
            NODE_ENV:           development
            NODE_OPTIONS:       "--experimental-vm-modules --no-webstorage"
            NODE_NO_WARNINGS:   "1"
        network_mode: host
EOF
fi

}

composehack() {

    if  ! grep -q "user" "docker-compose.yml"; then
        echo "Adding user configuration line to docker-compose.yml for GNU/Linux users."
        sed -i "/working_dir\:/{s@^\( \+\)@\1user\: $PROJECT_UID\:$PROJECT_GID\n\1@}" docker-compose.yml
    fi

}

node() {

if [[ ! -f package.json ]]; then

    docker compose run --rm node yarn init

else

    docker compose run --rm node yarn install

fi

}

start() {

    compose

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then

        composehack

    fi

    node

#    docker compose run --rm node yarn c:all

#    docker compose run --rm node yarn c:formatero
#    docker compose run --rm node yarn formatero

#    docker compose run --rm node yarn c:lintero
#    docker compose run --rm node yarn lintero

#    docker compose run --rm node yarn c:monorepo
#    docker compose run --rm node yarn monorepo

    docker compose run --rm node yarn c:testero
    docker compose run --rm node yarn testero

}

if declare -F "$1" > /dev/null; then
    "$1"
else
    echo "Usage: $0 {start|clean|compose|composehack|node}"
    exit 1
fi
