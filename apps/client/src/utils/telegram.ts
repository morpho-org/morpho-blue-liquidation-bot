export class TelegramNotifier {
  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
  ) {}

  async sendMessage(message: string) {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const body = JSON.stringify({
        chat_id: this.chatId,
        text: message,
        disable_web_page_preview: true,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(
          `[Telegram] Failed to send notification: ${response.status} ${response.statusText} - ${error}`,
        );
      }
    } catch (error) {
      console.error("[Telegram] Failed to send notification:", error);
    }
  }

  async liquidationDetected(
    chainId: number,
    marketId: string,
    borrower: string,
    collateralToken: string,
    collateralAmount: string,
    type: "liquidation" | "pre-liquidation",
  ) {
    await this.sendMessage(
      `🔴 Liquidation détectée (${type})\nchainId: ${chainId}\nmarketId: ${marketId}\nborrower: ${borrower}\ncollateralToken: ${collateralToken}\ncollateralAmount: ${collateralAmount}`,
    );
  }

  async liquidationExecuted(
    chainId: number,
    marketId: string,
    borrower: string,
    profitUsd: number | undefined,
    txHash: string | undefined,
    type: "liquidation" | "pre-liquidation",
  ) {
    const explorerLink = txHash ? getExplorerTxUrl(chainId, txHash) : undefined;
    const profitText = profitUsd === undefined ? "unknown" : `${profitUsd.toFixed(2)} USD`;
    const message = [
      `✅ Liquidation exécutée (${type})`,
      `chainId: ${chainId}`,
      `marketId: ${marketId}`,
      `borrower: ${borrower}`,
      `profit: ${profitText}`,
    ];
    if (explorerLink) message.push(`tx: ${explorerLink}`);
    await this.sendMessage(message.join("\n"));
  }

  async liquidationFailed(
    chainId: number,
    marketId: string,
    borrower: string,
    reason: string,
    type: "liquidation" | "pre-liquidation",
  ) {
    const truncated = reason.length > 300 ? reason.slice(0, 300) + "..." : reason;
    await this.sendMessage(
      `❌ Liquidation échouée (${type})\nchainId: ${chainId}\nmarketId: ${marketId}\nborrower: ${borrower}\nraison: ${truncated}`,
    );
  }

  async botStarted(chains: number[]) {
    const timestamp = new Date().toISOString();
    await this.sendMessage(`✅ Bot lancé à ${timestamp}\nChaînes: ${chains.join(", ")}`);
  }
}

export function createTelegramNotifier(): TelegramNotifier | undefined {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (!telegramBotToken || !telegramChatId) return undefined;
  return new TelegramNotifier(telegramBotToken, telegramChatId);
}

function getExplorerTxUrl(chainId: number, txHash: string) {
  switch (chainId) {
    case 11155111:
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    case 8453:
      return `https://base.etherscan.io/tx/${txHash}`;
    case 42161:
      return `https://arbiscan.io/tx/${txHash}`;
    case 999:
      return `https://hyperevmscan.io/tx/${txHash}`;
    default:
      return undefined;
  }
}
