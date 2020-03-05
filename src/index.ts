import dotenv from 'dotenv';
import * as fs from 'fs';
import * as Discord from 'discord.js';
import Markov from 'markov-strings';

const env = dotenv.config();

const logger: fs.WriteStream = fs.createWriteStream(process.env.LOGS_PATH, {
  flags: 'a+',
});
const quotes: string[] = fs.readFileSync(process.env.QUOTES_PATH, 'utf8').split('\n');


// MARKOV
const generatePhrase = (type: 'avow' | 'quote', word?: string): string => {
  let answer = '';
  let markov: Markov;

  if (type === 'avow') {
    const sentences = fs
      .readFileSync(process.env.LOGS_PATH, 'utf8')
      .split('\n')
      .map((i) => `${i.charAt(0).toUpperCase()}${i.substring(1)}.`);
    markov = new Markov(sentences, { stateSize: 1 });
  }

  if (type === 'quote') {
    markov = new Markov(quotes, { stateSize: 2 });
  }

  markov.buildCorpus();

  try {
    if (type === 'avow') {
      answer = markov.generate({
        maxTries: 5000,
        filter: (res: { score: number; string: string }): boolean => (
          res.string.endsWith('.')
          && (/[А-ЯA-Z]\S+/).test(res.string.split(' ')[0])
          && (word
            ? (res.score > 400 && res.string.split(' ').includes(word))
            : (res.score > 600 && res.string.split(' ').length >= 4))
        ),
      }).string;
      return answer.slice(0, -1).toLowerCase();
    }

    if (type === 'quote') {
      answer = markov.generate({
        maxTries: 5000,
        filter: (res: { score: number; string: string }): boolean => (
          res.string.endsWith('.')
          && (/[А-ЯA-Z]\S+/).test(res.string.split(' ')[0])
          && res.string.split(' ').length <= 30
          && res.score > 1000
        ),
      }).string;
      return answer;
    }
  } catch {
    return '404: Not found :)';
  }
};


// DISCORD
interface DiscordOpts {
  readonly TOKEN: string;
  readonly BOT: string;
  readonly GUILD: string;
  readonly CHANNEL: string;
}
interface DiscordMsg {
  readonly author: {
    readonly id: string;
  };
  readonly content: string;
  reply(msg: string): void;
}

const DISCORD_OPTS: DiscordOpts = {
  TOKEN: process.env.DISCORD_TOKEN,
  BOT: process.env.DISCORD_BOT_ID,
  GUILD: process.env.DISCORD_GUILD_ID,
  CHANNEL: process.env.DISCORD_CHANNEL_ID,
};
const client: Discord.Client = new Discord.Client();
client.login(DISCORD_OPTS.TOKEN);

client.on('message', (msg: DiscordMsg) => {
  if (msg.author.id === DISCORD_OPTS.BOT) return;

  let sendToChannel = false;
  let cmd: string;
  if (/\B!\w+/.test(msg.content)) {
    cmd = msg.content.match(/\B!\w+/)[0].toLowerCase();
  }

  if (cmd) {
    let answer = '';

    switch (cmd) {
      case '!report':
        answer = 'Observing...';
        break;

      case '!yesno':
        answer = Math.random() >= 0.5 ? 'Yes' : 'No';
        break;

      case '!iq':
        answer = Math.floor(Math.random() * 151 + 50).toString();
        break;

      case '!roll': {
        const dice: string = msg.content.match(/\B!\w+\s(\w+)/)[1];
        if (Number.isInteger(+dice)) {
          answer = Math.floor(Math.random() * +dice + 1).toString();
        } else answer = 'Incorrect dice';
        break;
      }

      case '!avow':
        answer = generatePhrase('avow');
        sendToChannel = true;
        break;

      case '!about': {
        const topic: string = msg.content.match(/\B!\w+\s(\w+)/)[1];
        answer = generatePhrase('avow', topic);
        sendToChannel = true;
        break;
      }

      case '!quote':
        answer = generatePhrase('quote');
        sendToChannel = true;
        break;

      default:
        break;
    }

    if (answer !== '') {
      if (sendToChannel) {
        const channel: Discord.GuildChannel = client
          .guilds.get(DISCORD_OPTS.GUILD)
          .channels.get(DISCORD_OPTS.CHANNEL);

        if (!((c): c is Discord.TextChannel => c.type === 'text')(channel)) {
          return;
        }

        channel.send(answer);
      } else msg.reply(answer);
    }
  } else {
    const editedMsg: string = msg.content
      .replace(/@\S+|<\S+|http\S+/g, '')
      .replace(/\s{2,}/g, ' ')
      .toLowerCase()
      .trim();

    if (editedMsg !== ' ' && editedMsg.split(' ').length > 1) {
      logger.write(`${editedMsg}\n`);
    }
  }
});
