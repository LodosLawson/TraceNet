import tkinter as tk
from tkinter import ttk, messagebox
import threading
import time
from wallet import WalletManager
from miner import MinerClient
from explorer import ExplorerClient

class MiningApp:
    def __init__(self, root):
        self.root = root
        self.root.title("TraceNet Miner Tool V1.0")
        self.root.geometry("600x450")

        self.wallet_manager = WalletManager()
        self.miner_client = MinerClient()
        self.explorer_client = ExplorerClient()

        # Styles
        style = ttk.Style()
        style.theme_use('clam')

        # Tabs
        self.notebook = ttk.Notebook(root)
        self.notebook.pack(expand=True, fill='both', padx=10, pady=10)

        self.tab_wallet = ttk.Frame(self.notebook)
        self.tab_miner = ttk.Frame(self.notebook)
        self.tab_explorer = ttk.Frame(self.notebook)

        self.notebook.add(self.tab_wallet, text="  Wallet  ")
        self.notebook.add(self.tab_miner, text="  Miner  ")
        self.notebook.add(self.tab_explorer, text="  Explorer  ")

        self.setup_wallet_tab()
        self.setup_miner_tab()
        self.setup_explorer_tab()

        # Auto-refresh stats
        self.root.after(2000, self.update_stats)

    def setup_wallet_tab(self):
        frame = ttk.LabelFrame(self.tab_wallet, text="Keys", padding=20)
        frame.pack(fill='x', padx=20, pady=20)

        ttk.Label(frame, text="Public Key (Address):").pack(anchor='w')
        self.lbl_pub = ttk.Entry(frame, width=60)
        self.lbl_pub.pack(fill='x', pady=(5, 15))
        
        ttk.Label(frame, text="Private Key:").pack(anchor='w')
        self.lbl_priv = ttk.Entry(frame, width=60, show="*")
        self.lbl_priv.pack(fill='x', pady=(5, 15))

        btn_frame = ttk.Frame(frame)
        btn_frame.pack(fill='x')
        
        ttk.Button(btn_frame, text="Generate New Wallet", command=self.generate_wallet).pack(side='left', padx=5)
        ttk.Button(btn_frame, text="Show Private Key", command=self.toggle_priv_key).pack(side='left', padx=5)

        # Actions
        frame_act = ttk.LabelFrame(self.tab_wallet, text="Actions", padding=20)
        frame_act.pack(fill='x', padx=20, pady=5)
        ttk.Label(frame_act, text="Use this wallet to run your node and receive fees.").pack(anchor='w')

        self.refresh_wallet_display()

    def setup_miner_tab(self):
        frame = ttk.Frame(self.tab_miner, padding=30)
        frame.pack(fill='both', expand=True)

        self.lbl_status = ttk.Label(frame, text="Miner Status: STOPPED", font=("Arial", 14, "bold"), foreground="red")
        self.lbl_status.pack(pady=20)

        self.btn_start = ttk.Button(frame, text="START MINING", command=self.start_mining, width=20)
        self.btn_start.pack(pady=10)

        self.btn_stop = ttk.Button(frame, text="STOP MINING", command=self.stop_mining, width=20, state='disabled')
        self.btn_stop.pack(pady=10)

        ttk.Label(frame, text="Node URL: http://localhost:3000").pack(side='bottom', pady=10)

    def setup_explorer_tab(self):
        frame = ttk.Frame(self.tab_explorer, padding=20)
        frame.pack(fill='both', expand=True)

        self.txt_stats = tk.Text(frame, height=20, width=70)
        self.txt_stats.pack(pady=10)

        ttk.Button(frame, text="Refresh Stats", command=self.update_stats).pack()

    def refresh_wallet_display(self):
        if self.wallet_manager.public_key:
            self.lbl_pub.delete(0, tk.END)
            self.lbl_pub.insert(0, self.wallet_manager.public_key)
            self.lbl_priv.delete(0, tk.END)
            self.lbl_priv.insert(0, self.wallet_manager.private_key)
        else:
            self.lbl_pub.insert(0, "No wallet found")

    def generate_wallet(self):
        if messagebox.askyesno("Confirm", "Overwrite existing wallet? This cannot be undone."):
            self.wallet_manager.generate_wallet()
            self.refresh_wallet_display()

    def toggle_priv_key(self):
        if self.lbl_priv['show'] == '*':
            self.lbl_priv['show'] = ''
        else:
            self.lbl_priv['show'] = '*'

    def start_mining(self):
        if not self.wallet_manager.public_key:
            messagebox.showerror("Error", "Please generate a wallet first!")
            return
        
        self.miner_client.start_loop(self.wallet_manager.public_key)
        self.lbl_status.config(text="Miner Status: RUNNING", foreground="green")
        self.btn_start.config(state='disabled')
        self.btn_stop.config(state='normal')

    def stop_mining(self):
        self.miner_client.stop_loop()
        self.lbl_status.config(text="Miner Status: STOPPED", foreground="red")
        self.btn_start.config(state='normal')
        self.btn_stop.config(state='disabled')

    def update_stats(self):
        stats = self.explorer_client.get_stats()
        self.txt_stats.delete(1.0, tk.END)
        self.txt_stats.insert(tk.END, str(stats)) # Pretty print json if possible using json.dumps
        
        # Schedule next update if tab is visible? 
        # For simplicity, just run it
        # self.root.after(5000, self.update_stats)

if __name__ == "__main__":
    root = tk.Tk()
    app = MiningApp(root)
    root.mainloop()
