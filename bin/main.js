// This loads the environment variables from the .env file
require('dotenv-extended').load({
    errorOnMissing: true
});

var express = require('express');

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

    if (entities.length === 0) {
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
            var reply = new builder.Message().address(session.message.address);
            reply.attachmentLayout(builder.AttachmentLayout.carousel).addAttachment(new builder.HeroCard(session)
                .title('我没法识别您所说的语言,请换一种说法,或者直接使用当前位置, mortal')
                .subtitle('例:[厦门软件园怎么走]')
                .buttons([
                    builder.CardAction.openUrl(session, process.env.LINDE_BUS_URL + 'useCurrent=true', '当前位置')
                ]));
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
    console.log('正在查询天气' + ', 并返回给' + session.message.address);
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
    reply.attachmentLayout(builder.AttachmentLayout.carousel).addAttachment(new builder.HeroCard(session)
        .title('我没法识别您所说的语言,请换一种说法,或者直接使用当前位置, mortal')
        .subtitle('例:[厦门软件园怎么走]')
        .buttons([
            builder.CardAction.openUrl(session, process.env.LINDE_BUS_URL + 'useCurrent=true', '当前位置')
        ]));
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