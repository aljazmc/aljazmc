#!/bin/bash

## Variables

#PROJECT_NAME=`echo ${PWD##*/}` ## PROJECT_NAME = parent directory
PROJECT_UID=$(id -u)
PROJECT_GID=$(id -g)

## Functions

biome() {

if [[ ! -f ale/biome ]]; then

    mkdir -p ale
    touch ale/biome

    cat << EOF > ale/biome
#!/bin/sh

docker compose run --rm node yarn biome lsp-proxy
EOF

    chmod +x ale/biome
fi

}

clean() {

    docker compose down -v --rmi all --remove-orphans
    rm -rf \
        ale \
        coverage \
        dist \
        docker-compose.yml \
        node_modules \
        packages/*/bin \
        tsconfig.tsbuildinfo \
        .cache \
        .pnp.cjs \
        .pnp.loader.mjs \
        .vim \
        .vimrc \
        .yarn/berry \
        .yarn/bin \
        .yarn/cache \
        .yarn/sdks \
        .yarn/unplugged \
        .yarn/install-state.gz \
        .yarnrc

    find . \( -type f -name "*.d.ts" \
                   -o -name "*.js" \
                   -o -name "*.jsx" \
                   -o -name "*.tsbuildinfo" \) -delete

}


compose() {

if [[ ! -f docker-compose.yml ]]; then
    cat << EOF > docker-compose.yml
services:
    node:
        image: node:current-alpine
        working_dir: $PWD
        volumes:
            - /home/$USER/.yarnrc.yml:/home/$USER/.yarnrc.yml
            - .:$PWD
        environment:
            HOME:               $PWD
            NODE_ENV:           development
            NODE_OPTIONS:       "--no-webstorage"
            PATH:               "$PATH:$HOME/.yarn/releases/"
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

docker compose run --rm node sh -c "printenv"

}

vimrc() {
	
if [[ ! -f .vimrc ]]; then
    cat << EOF > .vimrc
set shell=/bin/sh

" html
autocmd Filetype html
    \ setlocal tabstop=4 |
    \ setlocal shiftwidth=4 |
    \ setlocal softtabstop=0 |
    \ setlocal noexpandtab

" js,jsx,ts,tsx,json
autocmd Filetype js,jsx,ts,tsx,json
    \ setlocal tabstop=4 |
    \ setlocal shiftwidth=4 |
    \ setlocal softtabstop=0 |
    \ setlocal expandtab |
    \ setlocal autoindent |
    \ setlocal smartindent

" md
autocmd Filetype md
    \ setlocal tabstop=4 |
    \ setlocal shiftwidth=4 |
    \ setlocal softtabstop=0 |
    \ setlocal noexpandtab |
    \ setlocal nosmarttab

" sh
autocmd Filetype sh
    \ setlocal tabstop=4 |
    \ setlocal shiftwidth=4 |
    \ setlocal softtabstop=0 |
    \ setlocal expandtab

" yml
autocmd Filetype yml
    \ setlocal tabstop=4 |
    \ setlocal shiftwidth=4 |
    \ setlocal softtabstop=0 |
    \ setlocal expandtab

let g:ale_biome_executable = '$PWD/ale/biome'
let g:ale_biome_use_global = 1
EOF
fi

}

start() {

    compose

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then

        composehack

        if [[ "$USER" == "aljazmc" ]]; then

            vimrc
            biome

        fi
    fi

    node

    docker compose run --rm node yarn build:all

##    docker compose run --rm node yarn formatero
    docker compose run --rm node yarn glob-it
##    docker compose run --rm node lintero
##    docker compose run --rm node monorepo
##    docker compose run --rm node read-it
##    docker compose run --rm node ship-it
##    docker compose run --rm node tag-it
##    docker compose run --rm node testero
##    docker compose run --rm node zip-it

}

"$1"
