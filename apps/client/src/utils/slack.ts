import { Address, Hex } from "viem";

export default class Slack {
  slackPostMessageUrl = "https://slack.com/api/chat.postMessage";
  protected defaultIconUrl = "https://cdn.morpho.xyz/assets/pepe/pepe.png";
  protected defaultUsername = "Morpho Bot";
  protected defaultFiletype = "json";
  constructor(
    private readonly _token: string,
    private readonly _channel: string,
  ) {}

  get channel() {
    return this._channel;
  }

  async notifyLiquidation(params: NotifyLiquidationParams) {
    const message = `${params.chainName} ${params.operation} on market ${params.marketId} ${params.txHash ? `(tx hash: ${params.txHash})` : ""}${params.badDebtPosition ? " (Bad Debt Position)" : ""}${params.estimatedUSDProfit ? ` (Estimated USD Profit: ${params.estimatedUSDProfit})` : ""}`;
    await this.sendBlocks([
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: message,
        },
      },
    ]);
  }

  async sendBlocks(
    blocks: any[],
    {
      username,
      icon_url,
      channel,
      thread,
    }: {
      username?: string;
      icon_url?: string;
      channel?: string;
      thread?: string;
    } = {},
  ) {
    const resp = await fetch(this.slackPostMessageUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${this._token}`,
      },
      body: JSON.stringify({
        channel: channel ?? this._channel,
        icon_url: icon_url ?? this.defaultIconUrl,
        username: username ?? this.defaultUsername,
        thread_ts: thread,
        blocks,
      }),
    });
    const data = (await resp.json()) as {
      blocks?: unknown;
      ok: boolean;
      error?: string;
      channel: string;
      ts: string;
      message: {
        type: "message";
        app_id: string;
        bot_id: string;
      };
    };
    // @eslint-disable-next-line
    const { blocks: d, ...resp1 } = data;
    if (!resp1.ok) {
      throw Error(resp1.error);
    }
    return resp1 as {
      channel: string;
      ts: string;
      message: {
        type: "message";
        app_id: string;
        bot_id: string;
      };
    };
  }
}

export type NotifyLiquidationParams = {
  chainName: string;
  operation: "liquidation" | "pre-liquidation";
  marketId: Hex;
  user: Address;
  badDebtPosition: boolean;
  txHash?: Hex;
  estimatedUSDProfit?: number;
};
