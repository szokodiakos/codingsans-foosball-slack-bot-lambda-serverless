'use strict';

import * as _ from 'lodash';
import * as vandium from 'vandium';
import * as Slack from 'slack-node';
import * as jsdom from 'jsdom';

interface ICommand {
  token?: string;
  team_id?: string;
  team_domain?: string;
  channel_id?: string;
  channel_name?: string;
  user_id?: string;
  user_name?: string;
  command?: string; // /something
  text?: string; // /something foo <- foo is the thext
  response_url?: string;
}

interface IResponse {
  statusCode: number;
}

interface IAttachment {
  color?: string;
  text?: string;
  pretext?: string;
}

interface IPlayer {
  name: string;
  oldRating: number;
  newRating: number;
}

interface ITeams {
  teamOne: IPlayer[];
  teamTwo: IPlayer[];
}

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;

const GREEN_COLOR = '#36a64f';
const YELLOW_COLOR = '#ffef60';
const RED_COLOR = '#ff6060';

if (!SLACK_WEBHOOK || !SLACK_CHANNEL) {
  console.error('missing env variables');
  throw new Error('missing env variables');
}

const slack = new Slack();

slack.setWebhook(SLACK_WEBHOOK);

function slackWebhook(options: Slack.WebhookOptions) {
  return new Promise((resolve, reject) => {
    slack.webhook(options, (err, result: Slack.WebhookResponse) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
}

const renderMatchUpdate = (teamOne: IPlayer[], teamTwo: IPlayer[]) => {
  const vsLabel = `${teamOne.join(' ')} vs ${teamTwo.join(' ')}`;
  let isFirst = true;

  const attachments = [...teamOne, ...teamTwo].map(teamMember => {
    const { oldRating, newRating, name } = teamMember;

    const attachment: IAttachment = {};
    if (newRating > oldRating) {
      attachment.color = GREEN_COLOR;
    } else if (newRating === oldRating) {
      attachment.color = YELLOW_COLOR;
    } else {
      attachment.color = RED_COLOR;
    }

    attachment.text = renderMatchUpdateText(name, oldRating, newRating);

    if (isFirst) {
      attachment.pretext = `Rating changes after ${vsLabel} match:`;
      isFirst = false;
    }

    return attachment;
  });
  return attachments;
}

const renderMatchUpdateText = (name: string, oldRating: number, newRating: number) =>
  [
    `${name}: ${oldRating} → ${newRating}`,
    newRating >= oldRating ?
      `(+${newRating - oldRating})` :
      `(-${oldRating - newRating})`
  ].join(' ');

async function parsePlayers(text?: string): Promise<ITeams | undefined> {
  if (!text) {
    return;
  }
  const [rawTeamOne, rawTeamTwo] = text.split('vs.');
};

export const postMatch = vandium(async function postMatch(): Promise<IResponse> {
  const command: ICommand = { text: '@alice @bob vs. @chloe @dave 9-2' };
  const { text } = command;

  const parsedPlayers = await parsePlayers(text);
  if (!parsedPlayers) {
    return {
      statusCode: 400,
    };
  }

  const { teamOne, teamTwo } = parsedPlayers;
  await slackWebhook({
    username: 'csocso-sans-bot',
    icon_emoji: ':soccer:',
    channel: SLACK_CHANNEL,
    attachments: renderMatchUpdate(teamOne, teamTwo),
  });

  return {
    statusCode: 200,
  };
});
