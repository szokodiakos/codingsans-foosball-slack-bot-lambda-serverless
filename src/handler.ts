'use strict';

import * as _ from 'lodash';
import * as vandium from 'vandium';
import * as Slack from 'slack-node';
import * as jsdom from 'jsdom';
import * as graph from 'fbgraph';
import * as moment from 'moment-timezone';

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;
const ICONS = [':hamburger:', ':hotdog:', ':pizza:', ':taco:', ':burrito:', ':ramen:', ':stew:', ':curry:'];

if (!SLACK_WEBHOOK || !SLACK_CHANNEL || !FB_ACCESS_TOKEN) {
  console.error('missing env variables');
  throw new Error('missing env variables');
}

const KAMRA_URL = 'http://kamraetelbar.hu/kamra_etelbar_mai_menu.html';
const KAMRA_SELECTOR = '.shop_today_title';

const slack = new Slack();

slack.setWebhook(SLACK_WEBHOOK);
graph.setAccessToken(FB_ACCESS_TOKEN);

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

async function getKamra() {
  let window: any;
  try {
    window = await new Promise(
      (resolve, reject) => jsdom.env(KAMRA_URL, ['http://code.jquery.com/jquery.js'], (err, res) => err ? reject(err) : resolve(res))
    );

    const nodes = window.$(KAMRA_SELECTOR);

    const text = nodes.length && nodes.first().text();

    return {
      title: 'Kamra :rice:',
      title_link: KAMRA_URL,
      text: text,
    };
  } catch (err) {
    console.error('getKamra error', err);
    return {
      title: 'Kamra',
      title_link: KAMRA_URL,
      text: `Error: ${ JSON.stringify(err, void 0, 2) }`,
    };
  } finally {
    if (window) {
      window.close();
    }
  }
}

async function getAviator() {
  try {
    const result: { data: { message: string }[] } = await new Promise<any>(
      (resolve, reject) => graph.get(
        `/aviatorbistro/posts?since=${ moment().format('YYYY-MM-DD') }`,
        (err: any, res: any) => err ? reject(err) : resolve(res))
    );

    if (!result.data.length) {
      throw new Error('No posts today from Aviator');
    }

    const filteredPost = _.filter(result.data, (post) => (/mai/gi).test(post.message));

    if (!filteredPost.length) {
      throw new Error('No menu posts today from Aviator');
    }

    const maiMenuPost = result.data[0].message;

    const maiMenu = _.filter(maiMenuPost.split('\n'), (s) => /^\s*\~/.test(s)).join('\n');

    return {
      title: 'Aviator :spaghetti:',
      title_link: 'https://www.facebook.com/pg/aviatorbistro/posts/?ref=page_internal',
      text: maiMenu,
    };
  } catch (err) {
    console.error('getAviator error', err);
    return {
      title: 'Aviator',
      title_link: 'https://www.facebook.com/pg/aviatorbistro/posts/?ref=page_internal',
      text: `Error: ${ JSON.stringify(err, void 0, 2) }`,
    };
  }
}

export const food = vandium(async function food(): Promise<any> {
  const attachments = await Promise.all([
    getKamra(),
    getAviator(),
  ]);

  await slackWebhook({
    username: 'fooding-sans-bot',
    icon_emoji: ICONS[Math.trunc(Math.random() * ICONS.length)],
    channel: SLACK_CHANNEL,
    attachments,
  });

  return {
    statusCode: 200,
  };
});
