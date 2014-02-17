#!/bin/bash

if [ $# -ne 3 ];
then
    echo Usage: $0 unused-private_key app_name host_name
    exit 1
fi
# git bundle create deploy/$2.bundle master
tar jcvf $2.tar.bz2 -X $2/.gitignore --exclude $2/.git $2
# when using a PEM
# scp -i $1 $2.tar.bz2 ubuntu@$3:
# scp -i $1 install.sh ubuntu@$3:
# ssh -i $1 ubuntu@$3 bash install.sh $2
scp $2.tar.bz2 allan@$3:
scp install.sh allan@$3:
ssh -t allan@$3 bash install.sh $2
echo Done.
