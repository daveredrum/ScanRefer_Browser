source ../env.sh
echo "base-url:" $NODE_BASE_URL
SESSION_SECRET=theyaretakingthehobbitstoeisengard
NODE_BASE_URL=$NODE_BASE_URL HTTP_SERVER_PORT=$HTTP_SERVER_PORT SESSION_SECRET=$SESSION_SECRET npm start
