#!/bin/bash

## Variables

#PROJECT_NAME=`echo ${PWD##*/}` ## PROJECT_NAME = parent directory
PROJECT_UID=$(id -u)
PROJECT_GID=$(id -g)

## Functions

clean() {

    ## always in the project, wherever the script is run from
    cd "$(dirname "$(realpath "$0")")" || exit 1

    if [[ -f docker-compose.yml ]] && command -v docker > /dev/null; then
        docker compose down -v --rmi all --remove-orphans
    fi

    ## generated files only, sources, secrets and .yarn/{patches,plugins,releases,versions} stay

    rm -rf \
        .cache \
        .env.yarn \
        .node_repl_history \
        .npm \
        .pnp.cjs \
        .pnp.loader.mjs \
        .yarn/.cache \
        .yarn/__virtual__ \
        .yarn/berry \
        .yarn/bin \
        .yarn/build-state.yml \
        .yarn/cache \
        .yarn/install-state.gz \
        .yarn/sdks \
        .yarn/unplugged \
        ./*.tgz \
        coverage \
        docker-compose.yml \
        node_modules \
        tsconfig.tsbuildinfo \
        yarn.lock

    ## build output of the workspaces, packages/** and shared/**, at any depth
    find packages shared \
        -name node_modules -prune -exec rm -rf {} + -o \
        \( -type d -name bin -o -name '*.tgz' -o -name tsconfig.tsbuildinfo \) -prune -exec rm -rf {} +

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

    docker compose run --rm node yarn c:all

#    docker compose run --rm node yarn c:formatero
#    docker compose run --rm node yarn formatero

#    docker compose run --rm node yarn c:lintero
#    docker compose run --rm node yarn lintero

#    docker compose run --rm node yarn c:monorepo
#    docker compose run --rm node yarn monorepo

#    docker compose run --rm node yarn c:testero
#    docker compose run --rm node yarn testero

}

if declare -F "$1" > /dev/null; then
    "$1"
else
    echo "Usage: $0 {start|clean|compose|composehack|node}"
    exit 1
fi
