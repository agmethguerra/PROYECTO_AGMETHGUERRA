export class ChatUI {
  constructor(game) {
    this.game = game;
    this.messagesDiv = document.getElementById("chat-messages");
    this.input = document.getElementById("chat-input");
    this.sendBtn = document.getElementById("chat-send");
    
    this.sendBtn.addEventListener("click", () => {
      this.sendMessage();
    });
    
    this.input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
      if (e.key === "Escape") {
        this.input.blur();
      }
    });
  }
  
  sendMessage() {
    const text = this.input.value.trim();
    if (text === "") return;
    if (!this.game.network || !this.game.network.connected) return;
    
    this.game.network.sendChat(text);
    this.input.value = "";
  }
  
  addMessage(msg) {
    const messageEl = document.createElement("div");
    messageEl.className = "chat-message";
    
    if (msg.type === "system") {
      const systemEl = document.createElement("span");
      systemEl.className = "chat-system";
      systemEl.textContent = "• " + msg.text;
      messageEl.appendChild(systemEl);
    } else {
      const playerEl = document.createElement("span");
      playerEl.className = "chat-player";
      playerEl.textContent = (msg.playerName || "Alguien") + ": ";
      
      const textEl = document.createElement("span");
      textEl.textContent = msg.text;
      
      messageEl.appendChild(playerEl);
      messageEl.appendChild(textEl);
    }
    
    this.messagesDiv.appendChild(messageEl);
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
  }
  
  clear() {
    if (this.messagesDiv) {
      this.messagesDiv.innerHTML = "";
    }
  }
}
