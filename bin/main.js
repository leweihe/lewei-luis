// This loads the environment variables from the .env file
require('dotenv-extended').load({
    errorOnMissing: true
});

var express = require('express');

//utils
var Swagger = require('swagger-client');
var rp = require('request-promise');

//botframework
var builder = require('botbuilder');
var restify = require('restify');

// var webot = require('weixin-robot');

var amap = require('./amap.js');
var whether = require('./whether.js');

var mongod = require('./mongod');

//LUIS
var model = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/aac6c13c-63dc-444e-8f61-7ac4b97fa5ca?subscription-key=96429d5c0efc4cb692dddde6677c0f98&verbose=true&q=';

var recognizer = new builder.LuisRecognizer(model);

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create connector and listen for messages
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

server.post('/api/messages', connector.listen());

var instructions = '提供一个地址,我将帮助你定位最便捷的班车, mortal.';

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
bot.recognizer(recognizer);

bot.dialog('searchPath', [queryPath, choiceExactDest]).triggerAction({
    matches: '路线查询'
});

function queryPath(session, args) {
    //init userData
    var entities = builder.EntityRecognizer.findAllEntities(args.intent.entities, '地点');

    if (entities.length == 0) {
        entities = [session.message.text];
    }

    amap.searchInAmap(entities).then(function (dests) {
        var options = [];
        dests.forEach(function (dest, index) {
            options.push(dest.name + ' [' + dest.adname + ']');
        });
        session.userData.possiblePoints = dests;
        if (options.length > 0) {
            builder.Prompts.choice(session, "我为您列出了以下为三个可能的路径,请选择, mortal", options);
        } else {
            var reply = new builder.Message().address(session.message.address).text('对不起,我腿脚不好,没听清, mortal');
            bot.send(reply);
        }
    });
}

function choiceExactDest(session, result) {
    var reply = new builder.Message().address(session.message.address);
    amap.getAmapCard(session, builder, result.response).then(function (amapCards) {
        reply.attachmentLayout(builder.AttachmentLayout.carousel).attachments(amapCards);
        session.send(reply);
        session.endDialog("很高兴为您服务, mortal.");
    });
}

bot.dialog('searchWeather', [function (session, args) {

    var reply = new builder.Message().address(session.message.address);
    reply.text('为您查询天气');
    session.send(reply);
}]).triggerAction({
    matches: '天气查询'
});

bot.dialog('backdoor', [function (session, args) {
    mongod.backdoorVarify().then(function (data) {
        var reply = new builder.Message().address(session.message.address);
        reply.text(data);
        session.send(reply);
    })

}]).triggerAction({
    matches: 'backdoor'
});

bot.dialog('/', [function (session, args) {
    var reply = new builder.Message().address(session.message.address);
    reply.text('Hi, mortal');
    session.send(reply);
}]);

bot.on('conversationUpdate', function (activity) {
    // when user joins conversation, send instructions
    if (activity.membersAdded) {
        activity.membersAdded.forEach(function (identity) {
            if (identity.id === activity.address.bot.id) {
                var reply = new builder.Message().address(activity.address).text(instructions);
                bot.send(reply);
            }
        });
    }
});

/*
 for client
 */
// config items
var pollInterval = 1000;
var directLineSecret = 'xFs2O9vcjSI.cwA.D3k.OSVu8Q0CQ86aqDQjqp-kwCB-66E5GfZEXWwKPW87pKk';
var directLineClientName = 'DirectLineClient';
var directLineSpecUrl = 'https://docs.botframework.com/en-us/restapi/directline3/swagger.json';

var directLineClient = rp(directLineSpecUrl)
    .then(function (spec) {
        // client
        return new Swagger({
            spec: JSON.parse(spec.trim()),
            usePromise: true
        });
    })
    .then(function (client) {
        // add authorization header to client
        client.clientAuthorizations.add('AuthorizationBotConnector', new Swagger.ApiKeyAuthorization('Authorization', 'Bearer ' + directLineSecret, 'header'));
        return client;
    })
    .catch(function (err) {
        console.error('Error initializing DirectLine client', err);
    });

// once the client is ready, create a new conversation
directLineClient.then(function (client) {
    client.Conversations.Conversations_StartConversation()                          // create conversation
        .then(function (response) {
            return response.obj.conversationId;
        })                            // obtain id
        .then(function (conversationId) {
            sendMessagesFromConsole(client, conversationId);                        // start watching console input for sending new messages to bot
            pollMessages(client, conversationId);                                   // start polling messages from bot
        });
});

// Read from console (stdin) and send input to conversation using DirectLine client
function sendMessagesFromWeichat(client, conversationId) {
    //get weichat input
    var input = '';
    // send message
    client.Conversations.Conversations_PostActivity(
        {
            conversationId: conversationId,
            activity: {
                textFormat: 'plain',
                text: input,
                type: 'message',
                from: {
                    id: directLineClientName,
                    name: directLineClientName
                }
            }
        }).catch(function (err) {
        console.error('Error sending message:', err);
    });
}

// Read from console (stdin) and send input to conversation using DirectLine client
function sendMessagesFromConsole(client, conversationId) {
    var stdin = process.openStdin();
    process.stdout.write('Command> ');
    stdin.addListener('data', function (e) {
        var input = e.toString().trim();
        if (input) {
            // exit
            if (input.toLowerCase() === 'exit') {
                return process.exit();
            }

            // send message
            client.Conversations.Conversations_PostActivity(
                {
                    conversationId: conversationId,
                    activity: {
                        textFormat: 'plain',
                        text: input,
                        type: 'message',
                        from: {
                            id: directLineClientName,
                            name: directLineClientName
                        }
                    }
                }).catch(function (err) {
                console.error('Error sending message:', err);
            });

            process.stdout.write('Command> ');
        }
    });
}

// Poll Messages from conversation using DirectLine client
function pollMessages(client, conversationId) {
    console.log('Starting polling message for conversationId: ' + conversationId);
    var watermark = null;
    setInterval(function () {
        client.Conversations.Conversations_GetActivities({conversationId: conversationId, watermark: watermark})
            .then(function (response) {
                watermark = response.obj.watermark;                                 // use watermark so subsequent requests skip old messages
                return response.obj.activities;
            });
        // .then(printMessages);
    }, pollInterval);
}

// Helpers methods
function printMessages(activities) {
    if (activities && activities.length) {
        // ignore own messages
        activities = activities.filter(function (m) {
            return m.from.id !== directLineClientName
        });

        if (activities.length) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);

            // print other messages
            activities.forEach(printMessage);

            process.stdout.write('Command> ');
        }
    }
}

function printMessage(activity) {
    if (activity.text) {
        console.log(activity.text);
    }
}
