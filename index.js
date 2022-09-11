require("dotenv").config();
const { parse } = require("querystring");
var express = require("express");
var cors = require("cors");
const uuid = require("uuid");
const bodyParser = require("body-parser");
const https = require("https");
const request = require("request");
const rolloutUtil = require("./rolloutUtil.js");

var app = express();
app.use(cors());
app.use(express.static("public"));
app.use(bodyParser.json());

const API_ENDPOINT = process.env.API_ENDPOINT;
const RASAserver = process.env.RASAserver;

function message_from_request(req) {
  return req.body;
}

app.get("/hello", (req, res) => {
  res.status(200).json({
    message: "Hello from webhook",
    api_endpoint: `${API_ENDPOINT}`,
    rasa_server: `${RASAserver}`
  });
});

app.post("/bot", (req, res) => {
  var body = req.body;
  var recipient_id = body.payload.recipient;
  var text = body.payload.text;
  const rdrequest = body.payload.request;
  var botId = rdrequest.department.bot._id;
  var token = body.token;
  var project_id = body.payload.id_project;

  // immediatly reply to ROLLOUT
  res.status(200).send({ success: true });

  // you can optionally use the request id as a session identifier
  const session_id = rdrequest.request_id;

  runRASAQuery(text, function(result) {
    console.log("BOT: RASA REPLY: " + JSON.stringify(result));
    if (res.statusCode === 200) {
      /* you can optionally check the intent confidence
      var reply = "Intent under confidence threshold, can you rephrase?"
      if (result.intent.confidence > 0.8) {
        reply = result.reply
      }
      */

      // optionally you can parse a message tagged with microlang.
      // to get a button simply add * Button-label on a new line
      // i.e. result.reply = result.reply + "\n* Button"
      // const parsed_reply = RolloutUtil.parseReply(result.reply);
      // parsed_message = parsed_reply.message
      // sendMessage(
      //   {
      //    "text": parsed_message.text, // or message text
      //    "type": parsed_message.type, // or "text"
      //    "attributes": parsed_message.attributes, // can be null
      //    "metadata": parsed_message.metadata // used for media like images
      //  }, project_id, recipient, token, function (err) {
      //  console.log("Message sent. Error? ", err)
      //})

      sendMessage(
        {
          text: result.reply
        },
        project_id,
        recipient_id,
        token,
        err => {
          console.log("Message sent. Error? ", err);
        }
      );
    }
  });
});

function runRASAQuery(text, callback) {
  intents = {
    hello: "Hello from RASA\n*How are you?\n*oops sorry!",
    nlu_fallback: "Non ho capito"
  };

  request(
    {
      url: `${RASAserver}/model/parse`,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      json: {
        text: text,
        message_id: "optional"
      }
    },
    function(err, res, resbody) {
      console.log("res.statusCode:", res.statusCode);
      if (err) {
        console.log("An error occurred", err);
      } else if (res.statusCode >= 400) {
        console.log("status code error: res.statusCode = ", res.statusCode);
      } else {
        console.log("RASA REPLY:", resbody);
        if (
          resbody.response_selector &&
          resbody.response_selector.all_retrieval_intents &&
          resbody.response_selector.default &&
          resbody.response_selector.default.response &&
          resbody.response_selector.default.response.responses &&
          resbody.response_selector.default.response.responses.length > 0 &&
          resbody.response_selector.default.response.responses[0] &&
          resbody.response_selector.default.response.responses[0].text
        ) {
          resbody.reply =
            resbody.response_selector.default.response.responses[0].text;
        } else {
          resbody.reply = intents[resbody.intent.name];
        }
        callback(resbody);
      }
    }
  );
}

function sendMessage(msg_json, project_id, recipient, token, callback) {
  console.log("Sending message to Rollout: " + JSON.stringify(msg_json));
  request(
    {
      url: `${API_ENDPOINT}/${project_id}/requests/${recipient}/messages`,
      headers: {
        "Content-Type": "application/json",
        Authorization: "JWT " + token
      },
      json: msg_json,
      method: "POST"
    },
    function(err, res, resbody) {
      callback(err);
    }
  );
}

app.listen(3000, () => {
  console.log("server started");
});
