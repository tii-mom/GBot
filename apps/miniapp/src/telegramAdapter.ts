// Telegram WebApp Adapter for GrowthBot
// Handles both window.Telegram.WebApp environment and browser mocks for standalone previewing.

export interface TelegramUser {
  id: string;
  username: string;
  languageCode: string;
}

export interface ITelegramAdapter {
  isMock: boolean;
  init(): void;
  getUser(): TelegramUser;
  getStartParam(): string | null;
  showAlert(message: string): void;
  showConfirm(message: string, callback: (ok: boolean) => void): void;
  shareUrl(url: string, text: string): void;
  hapticImpact(style?: "light" | "medium" | "heavy"): void;
  setMainButton(text: string, onClick: () => void): void;
  hideMainButton(): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

class TelegramAdapter implements ITelegramAdapter {
  isMock = true;
  private onClickHandler: (() => void) | null = null;

  constructor() {
    if (typeof window !== "undefined" && window.Telegram?.WebApp && window.Telegram.WebApp.initData) {
      this.isMock = false;
    }
  }

  init() {
    if (!this.isMock) {
      window.Telegram?.WebApp.ready();
      window.Telegram?.WebApp.expand();
      // Apply safe area colors if supported
      if (window.Telegram?.WebApp.setHeaderColor) {
        window.Telegram.WebApp.setHeaderColor("#090a0f");
      }
      if (window.Telegram?.WebApp.setBackgroundColor) {
        window.Telegram.WebApp.setBackgroundColor("#090a0f");
      }
    } else {
      console.log("[Telegram Mock] Initialized in browser mode.");
    }
  }

  getUser(): TelegramUser {
    if (!this.isMock) {
      const tgUser = window.Telegram?.WebApp.initDataUnsafe?.user;
      if (tgUser) {
        return {
          id: String(tgUser.id),
          username: tgUser.username || "tg_user",
          languageCode: tgUser.language_code || "en",
        };
      }
    }
    // Check local storage or URL query for custom mock username
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const mockUser = params.get("username") || localStorage.getItem("gb_mock_username") || "alpha_user";
    const mockId = params.get("userId") || localStorage.getItem("gb_mock_user_id") || "123456789";
    return {
      id: mockId,
      username: mockUser,
      languageCode: "en",
    };
  }

  getStartParam(): string | null {
    const params = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

    const queryStartParam = params.get("tgWebAppStartParam");

    if (!this.isMock) {
      return window.Telegram?.WebApp.initDataUnsafe?.start_param
        || queryStartParam
        || null;
    }

    return queryStartParam;
  }

  showAlert(message: string) {
    if (!this.isMock) {
      window.Telegram?.WebApp.showAlert(message);
    } else {
      alert(message);
    }
  }

  showConfirm(message: string, callback: (ok: boolean) => void) {
    if (!this.isMock) {
      window.Telegram?.WebApp.showConfirm(message, callback);
    } else {
      const result = confirm(message);
      callback(result);
    }
  }

  shareUrl(url: string, text: string) {
    const fullUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    if (!this.isMock) {
      window.Telegram?.WebApp.openTelegramLink(fullUrl);
    } else {
      console.log(`[Telegram Mock] Sharing URL: ${fullUrl}`);
      // Copy to clipboard fallback for preview browser
      navigator.clipboard.writeText(fullUrl).then(() => {
        alert(`Share link copied to clipboard!\n\n${text}\n${url}`);
      }).catch(() => {
        alert(`Share link: ${url}\n\nText: ${text}`);
      });
    }
  }

  hapticImpact(style: "light" | "medium" | "heavy" = "medium") {
    if (!this.isMock) {
      window.Telegram?.WebApp.HapticFeedback?.impactOccurred(style);
    } else {
      console.log(`[Telegram Mock] Haptic feedback: ${style}`);
    }
  }

  setMainButton(text: string, onClick: () => void) {
    if (!this.isMock && window.Telegram) {
      const mainBtn = window.Telegram.WebApp.MainButton;
      mainBtn.setText(text);
      mainBtn.show();
      if (this.onClickHandler) {
        window.Telegram.WebApp.offEvent("mainButtonClicked", this.onClickHandler);
      }
      this.onClickHandler = onClick;
      window.Telegram.WebApp.onEvent("mainButtonClicked", onClick);
    } else {
      console.log(`[Telegram Mock] Set Main Button text: "${text}"`);
      const mockBtn = document.getElementById("tg-mock-main-button");
      if (mockBtn) {
        mockBtn.style.display = "block";
        mockBtn.innerText = text;
        const newBtn = mockBtn.cloneNode(true) as HTMLButtonElement;
        newBtn.addEventListener("click", onClick);
        mockBtn.parentNode?.replaceChild(newBtn, mockBtn);
      }
    }
  }

  hideMainButton() {
    if (!this.isMock && window.Telegram) {
      window.Telegram.WebApp.MainButton.hide();
    } else {
      const mockBtn = document.getElementById("tg-mock-main-button");
      if (mockBtn) {
        mockBtn.style.display = "none";
      }
    }
  }
}

export const telegramAdapter = new TelegramAdapter();
