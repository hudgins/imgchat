#!/bin/bash

# if which git;
# then
#     echo Git already installed.
# else
#     sudo apt-get update
#     sudo apt-get --yes install git
# fi

if [ -e $1 ];
then
    echo Previous installation detected.
    echo Updating application...
    tar jxf $1.tar.bz2
else
    echo Installing application...
    tar jxf $1.tar.bz2
fi

if which add-apt-repository;
then
    echo add-apt-repository already installed.
else
    sudo apt-get --yes install software-properties-common
fi

cd $1

echo Log file is ./$1.log

# node dependencies
if [ -e package.json ];
then
    if which node;
    then
        echo Node.js already installed.
    else
        echo Installing Node.js...
        sudo add-apt-repository ppa:chris-lea/node.js
        sudo apt-get update
        sudo apt-get --yes install nodejs make g++
    fi

    npm install
fi

if [ -e deploy/haproxy.cfg ];
then
    if which haproxy;
    then
        echo HAProxy already installed.
    else
        echo Installing HAProxy 1.5dev
        sudo add-apt-repository ppa:nilya/haproxy-1.5
        sudo apt-get update
        sudo apt-get --yes install haproxy
        sudo cp deploy/etc.default.haproxy /etc/default/haproxy
        sudo /etc/init.d/haproxy restart
    fi

    if ! diff -q deploy/haproxy.cfg /etc/haproxy/haproxy.cfg;
    then
        sudo cp -v deploy/haproxy.cfg /etc/haproxy/haproxy.cfg 
        sudo /etc/init.d/haproxy reload
    fi
fi

if [ -e deploy/redis.conf ];
then
    if which redis-cli;
    then
        echo Redis already installed.
    else
        echo Installing Redis...
        sudo add-apt-repository ppa:chris-lea/redis-server
        sudo apt-get update
        sudo apt-get --yes install redis-server
    fi

    if ! diff -q deploy/redis.conf /etc/redis/redis.conf;
    then
        sudo cp -v deploy/redis.conf /etc/redis/redis.conf 
        sudo /etc/init.d/redis-server force-reload
    fi
fi

if [ -e deploy/requires_mongodb ];
then
    if which mongo;
    then
        echo MongoDB already installed.
    else
        echo Installing MongoDB...
        sudo apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10
        echo deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen > $HOME/10gen.list
        sudo mv $HOME/10gen.list /etc/apt/sources.list.d
        sudo apt-get update
        sudo apt-get --yes install mongodb-10gen
    fi
fi

if [ -e deploy/specific.sh ];
then
    echo Executing app-specific installation script...
    deploy/specific.sh `pwd`
fi

# upstart config
if [ -e deploy/$1.conf ];
then
    sudo cp -v deploy/$1.conf /etc/init
    echo Running...
    sudo stop $1
    sudo start $1
fi

echo Done.

