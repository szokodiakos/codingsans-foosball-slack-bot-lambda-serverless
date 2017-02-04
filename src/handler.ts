'use strict';

import * as vandium from 'vandium';
import * as Slack from 'slack-node';

interface ICommand {
  token?: string;
  team_id?: string;
  team_domain?: string;
  channel_id?: string;
  channel_name?: string;
  user_id?: string;
  user_name?: string;
  command?: string; // /something
  text?: string; // /something foo <- foo is the text
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
  id: string;
  name: string;
  oldRating: number;
  newRating: number;
}

interface ITeams {
  winnerPlayers: IPlayer[];
  loserPlayers: IPlayer[];
}
const BOTNAME = 'csocso-sans-bot';
const K_FACTOR = 32; // used by Blizzard

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;

const GREEN_COLOR = '#36a64f';
const YELLOW_COLOR = '#ffef60';
const RED_COLOR = '#ff6060';

const PLAYER_PATTERN = /<@(\w*)\|(\w*)>/g;
const ONE_VS_ONE_PATTERN = /^<@\w*\|\w*> vs <@\w*\|\w*>$/g;
const TWO_VS_TWO_PATTERN = /^<@\w*\|\w*> <@\w*\|\w*> vs <@\w*\|\w*> <@\w*\|\w*>$/g;

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

const renderMatchUpdateText = (name: string, oldRating: number, newRating: number) =>
  [
    `${name}: ${oldRating} → ${newRating}`,
    newRating >= oldRating ?
      `(+${newRating - oldRating})` :
      `(-${oldRating - newRating})`
  ].join(' ');

const renderMatchUpdate = (winnerPlayers: IPlayer[], loserPlayers: IPlayer[]) => {
  const vsLabel = `${winnerPlayers.join(' ')} vs ${loserPlayers.join(' ')}`;
  let isFirst = true;

  const attachments = [...winnerPlayers, ...loserPlayers].map(teamMember => {
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
};

function parseTeams(text: string): ITeams {
  if (!ONE_VS_ONE_PATTERN.test(text) && !TWO_VS_TWO_PATTERN.test(text)) {
    throw new Error('Invalid text format, accepted formats: "@alice @bob vs @chloe @dave" or "@alice vs @bob"');
  }

  const [rawwinnerPlayers, rawloserPlayers] = text.split(' vs ');
  const winnerPlayers: IPlayer[] = rawwinnerPlayers.split(' ').map(player => {
    return {
      ...parsePlayer(player),
      oldRating: 0,
      newRating: 0,
    };
  });
  const loserPlayers: IPlayer[] = rawloserPlayers.split(' ').map(player => {
    return {
      ...parsePlayer(player),
      oldRating: 0,
      newRating: 0,
    };
  });
  return { winnerPlayers, loserPlayers };
};

function parsePlayer(rawPlayer: string): { name: string, id: string } {
  const match = PLAYER_PATTERN.exec(rawPlayer);
  if (!match || (match.length !== 3 || !match[1] || !match[2])) {
    throw new Error('Player(s) could not be parsed from text.');
  }

  return {
    id: match[1],
    name: match[2],
  };
}

function getEloDiff(winnerRating: number, loserRating: number) {
  const winnerChance = 1 / (1 + 10 * (winnerRating - loserRating) / 400);
  const winnerDiff = K_FACTOR * (1 - winnerChance);
  return winnerDiff;
}

function updateRatings(winnerPlayers: IPlayer[], loserPlayers: IPlayer[]): ITeams {
  const winnerPlayersAvgRating = winnerPlayers.reduce((sum, player) => sum + player.oldRating, 0);
  const loserPlayersAvgRating = loserPlayers.reduce((sum, player) => sum + player.oldRating, 0);
  const diff = getEloDiff(winnerPlayersAvgRating, loserPlayersAvgRating);

  return {
    winnerPlayers: winnerPlayers.map(winnerPlayer => ({ ...winnerPlayer, newRating: winnerPlayer.oldRating + diff })),
    loserPlayers: loserPlayers.map(loserPlayer => ({ ...loserPlayer, newRating: loserPlayer.oldRating - diff })),
  };
}

async function hydratePlayersFromDb(winnerPlayers: IPlayer[], loserPlayers: IPlayer[]): Promise<ITeams> {
  // TODO
  return { winnerPlayers, loserPlayers };
}

async function writePlayersToDb(winnerPlayers: IPlayer[], loserPlayers: IPlayer[]): Promise<ITeams> {
  // TODO
  return { winnerPlayers, loserPlayers };
}

export const postMatch = vandium(async function postMatch(): Promise<IResponse> {
  try {
    const command: ICommand = { text: '<@U012ABCDEF|alice> <@U112ABCDEF|bob> vs <@U212ABCDEF|chloe> <@U312ABCDEF|dave>' };
    const { text } = command;

    if (!text) {
      throw new Error('No text was given to command.');
    }
    const { winnerPlayers, loserPlayers } = parseTeams(text);

    const {
      winnerPlayers: hydratedWinnerPlayers,
      loserPlayers: hydratedLoserPlayers,
    } = await hydratePlayersFromDb(winnerPlayers, loserPlayers);

    const {
      winnerPlayers: updatedWinnerPlayers,
      loserPlayers: updatedLoserPlayers,
    } = updateRatings(hydratedWinnerPlayers, hydratedLoserPlayers);

    await writePlayersToDb(updatedWinnerPlayers, updatedLoserPlayers);

    await slackWebhook({
      username: BOTNAME,
      icon_emoji: ':soccer:',
      channel: SLACK_CHANNEL,
      attachments: renderMatchUpdate(updatedWinnerPlayers, updatedLoserPlayers),
    });

    return {
      statusCode: 200,
    };
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify(e),
    };
  }
});
