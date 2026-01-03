import subprocess
import tkinter as tk
from tkinter import ttk, messagebox
import threading
import time
import os
import sys
import json
from wallet import WalletManager
from miner import MinerClient
from explorer import ExplorerClient

class MiningApp:
    def __init__(self, root):
        self.root = root
        self.root.title("TraceNet Miner Tool V1.1")
        self.root.geometry("700x550")

        self.wallet_manager = WalletManager()
        self.miner_client = MinerClient()
        self.explorer_client = ExplorerClient()
        self.node_process = None
        self.env_manager = EnvManager()

        # Styles
        style = ttk.Style()
        style.theme_use('clam')

        # Tabs
        self.notebook = ttk.Notebook(root)
        self.notebook.pack(expand=True, fill='both', padx=10, pady=10)

        self.tab_dashboard = ttk.Frame(self.notebook)
        self.tab_wallet = ttk.Frame(self.notebook)
        self.tab_social = ttk.Frame(self.notebook)
        self.tab_miner = ttk.Frame(self.notebook)
        self.tab_explorer = ttk.Frame(self.notebook)

        self.notebook.add(self.tab_dashboard, text="  Dashboard  ")
        self.notebook.add(self.tab_wallet, text="  Wallet  ")
        self.notebook.add(self.tab_social, text="  Netra Feed  ")
        self.notebook.add(self.tab_miner, text="  Miner  ")
        self.notebook.add(self.tab_explorer, text="  Explorer  ")

        self.setup_dashboard_tab()
        self.setup_wallet_tab()
        self.setup_netra_tab()
        self.setup_miner_tab()
        self.setup_explorer_tab()

        # Auto-refresh stats
        self.root.after(2000, self.update_stats)

    def setup_dashboard_tab(self):
        # --- Node Control ---
        frame_ctrl = ttk.LabelFrame(self.tab_dashboard, text="Node Process", padding=20)
        frame_ctrl.pack(fill='x', padx=20, pady=10)

        self.lbl_node_status = ttk.Label(frame_ctrl, text="Node Status: STOPPED", font=("Arial", 12, "bold"), foreground="red")
        self.lbl_node_status.pack(pady=5)

        btn_frame = ttk.Frame(frame_ctrl)
        btn_frame.pack(pady=5)

        self.btn_run_node = ttk.Button(btn_frame, text="RUN LOCAL NODE", command=self.run_node, width=20)
        self.btn_run_node.pack(side='left', padx=10)

        self.btn_kill_node = ttk.Button(btn_frame, text="STOP NODE", command=self.stop_node, width=20, state='disabled')
        self.btn_kill_node.pack(side='left', padx=10)
        
        # Repair / Wipe Button
        ttk.Button(frame_ctrl, text="⚠ RESET CHAIN DATA (Fix Sync Errors)", command=self.wipe_db).pack(pady=5)

        # --- Configuration ---
        frame_config = ttk.LabelFrame(self.tab_dashboard, text="Configuration (Env)", padding=20)
        frame_config.pack(fill='x', padx=20, pady=10)

        # Port
        ttk.Label(frame_config, text="Node Port:").grid(row=0, column=0, sticky='w', padx=5, pady=5)
        self.entry_port = ttk.Entry(frame_config, width=10)
        self.entry_port.grid(row=0, column=1, sticky='w', padx=5, pady=5)
        self.entry_port.insert(0, self.env_manager.get("PORT", "3000"))

        # Access Mode (Host)
        ttk.Label(frame_config, text="Access:").grid(row=0, column=2, sticky='e', padx=5, pady=5)
        self.combo_host = ttk.Combobox(frame_config, values=["Local Only (127.0.0.1)", "Public (0.0.0.0)"], state="readonly", width=20)
        self.combo_host.grid(row=0, column=3, sticky='w', padx=5, pady=5)
        
        current_host = self.env_manager.get("HOST", "0.0.0.0")
        if "127.0.0.1" in current_host:
            self.combo_host.current(0)
        else:
            self.combo_host.current(1)

        # Peers
        ttk.Label(frame_config, text="Secure Peers (comma-sep):").grid(row=1, column=0, sticky='w', padx=5, pady=5)
        self.entry_peers = ttk.Entry(frame_config, width=50)
        self.entry_peers.grid(row=1, column=1, columnspan=3, sticky='w', padx=5, pady=5)
        self.entry_peers.insert(0, self.env_manager.get("PEERS", ""))

        ttk.Button(frame_config, text="Save Config", command=self.save_config).grid(row=2, column=3, sticky='e', padx=5, pady=10)
        
        # Advanced Editor Button
        ttk.Button(frame_config, text="Advanced .env Editor", command=self.open_env_editor).grid(row=2, column=0, sticky='w', padx=5, pady=10)

        # --- Earnings ---
        earn_frame = ttk.LabelFrame(self.tab_dashboard, text="Your Earnings", padding=20)
        earn_frame.pack(fill='both', expand=True, padx=20, pady=10)

        self.lbl_balance = ttk.Label(earn_frame, text="Balance: Loading...", font=("Arial", 16))
        self.lbl_balance.pack(pady=10)
        
        ttk.Label(earn_frame, text="(Includes Mining Rewards & Fees)").pack()
        
        # ... (Rest of UI unchanged up to save_config)

    def wipe_db(self):
        """Wipe the data directory to fix sync errors"""
        if self.node_process:
            messagebox.showerror("Error", "Please STOP the node before resetting data.")
            return

        if messagebox.askyesno("Confirm Reset", "⚠ This will DELETE your local blockchain database.\n\nThis fixes 'Invalid Link' and 'Sync Failed' errors.\nYour wallet/keys will NOT be deleted.\n\nAre you sure?"):
            try:
                # Path to data directory
                project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
                data_dir = os.path.join(project_root, 'data')
                
                # We need to delete folders 'chain-db', etc.
                import shutil
                if os.path.exists(data_dir):
                    shutil.rmtree(data_dir)
                    messagebox.showinfo("Success", "Data wiped successfully!\nStart the node to re-sync from fresh.")
                else:
                    messagebox.showinfo("Info", "Data directory already empty.")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to wipe data: {e}")

    def save_config(self):
        self.env_manager.set("PORT", self.entry_port.get())
        
        # Safe Defaults for Peers
        peers = self.entry_peers.get().strip()
        if not peers:
             peers = "https://tracenet-blockchain-136028201808.us-central1.run.app"
             self.entry_peers.delete(0, tk.END)
             self.entry_peers.insert(0, peers)
        
        self.env_manager.set("PEERS", peers)
        
        # Save Host
        selection = self.combo_host.get()
        if "Local" in selection:
            self.env_manager.set("HOST", "127.0.0.1")
        else:
            self.env_manager.set("HOST", "0.0.0.0")
            
        self.env_manager.save()
        messagebox.showinfo("Saved", "Configuration saved!\nRestart node to apply changes.")

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
        ttk.Label(frame_act, text="Use this wallet to run your node and receive fees.").pack(anchor='w', pady=5)
        
        ttk.Button(frame_act, text="BIND WALLET TO NODE (Set as Node Wallet)", command=self.bind_wallet).pack(fill='x')

        self.refresh_wallet_display()

    def bind_wallet(self):
        """Bind current UI wallet to Node's .env"""
        if not self.wallet_manager.private_key:
            messagebox.showerror("Error", "No wallet loaded!")
            return
            
        if messagebox.askyesno("Bind Wallet", "This will set your current GUI wallet as the NODE WALLET in .env.\n\nYour node will pay fees/rewards to this address.\n\nRestart node to apply?"):
            self.env_manager.set("NODE_WALLET_PRIVATE_KEY", self.wallet_manager.private_key)
            self.env_manager.save()
            messagebox.showinfo("Success", "Wallet bound to Node!\nPlease restart the local node.")

    def setup_netra_tab(self):
        # Create separate frames for Social and Wallet Actions
        main_frame = ttk.Frame(self.tab_social, padding=20)
        main_frame.pack(fill='both', expand=True)

        # --- LEFT: Social Feed ---
        left_frame = ttk.Frame(main_frame)
        left_frame.pack(side='left', fill='both', expand=True, padx=(0, 10))

        # Feed Area
        feed_frame = ttk.LabelFrame(left_frame, text="Netra Feed", padding=10)
        feed_frame.pack(fill='both', expand=True, pady=(0, 10))

        self.txt_feed = tk.Text(feed_frame, height=20, width=50)
        self.txt_feed.pack(fill='both', expand=True, side='left')
        
        scroll = ttk.Scrollbar(feed_frame, command=self.txt_feed.yview)
        scroll.pack(side='right', fill='y')
        self.txt_feed['yscrollcommand'] = scroll.set
        
        ttk.Button(feed_frame, text="Refresh Feed", command=self.refresh_feed).pack(pady=5)

        # --- RIGHT: Actions (Post, Transfer) ---
        right_frame = ttk.Frame(main_frame, width=300)
        right_frame.pack(side='right', fill='y', padx=(10, 0))

        # 1. Post Content
        post_frame = ttk.LabelFrame(right_frame, text="New Post", padding=10)
        post_frame.pack(fill='x', pady=(0, 20))
        
        self.entry_post = tk.Text(post_frame, height=5, width=30)
        self.entry_post.pack(fill='x', pady=5)
        
        ttk.Button(post_frame, text="Post Tweet", command=self.post_tweet).pack(fill='x')

        # 2. Transfer Coins
        trans_frame = ttk.LabelFrame(right_frame, text="Transfer Coins (LT)", padding=10)
        trans_frame.pack(fill='x')
        
        ttk.Label(trans_frame, text="To Wallet:").pack(anchor='w')
        self.entry_to = ttk.Entry(trans_frame, width=30)
        self.entry_to.pack(fill='x', pady=5)
        
        ttk.Label(trans_frame, text="Amount:").pack(anchor='w')
        self.entry_amount = ttk.Entry(trans_frame, width=30)
        self.entry_amount.pack(fill='x', pady=5)
        
        ttk.Button(trans_frame, text="SEND COINS", command=self.send_coins).pack(fill='x', pady=10)

    def post_tweet(self):
        content = self.entry_post.get("1.0", tk.END).strip()
        if not content:
            return

        if not self.wallet_manager.private_key:
            messagebox.showerror("Error", "You need a wallet to post!")
            return

        timestamp = int(time.time() * 1000)
        payload_data = {
            "content": content,
            "type": "post",
            "timestamp": timestamp
        }
        
        nonce = timestamp # Simple nonce
        
        # Transaction structure matching TransactionModel.ts
        tx = {
            "tx_id": "", # Will be generated by server if empty, but for signing we need structure
            "from_wallet": self.wallet_manager.public_key,
            "to_wallet": self.wallet_manager.public_key, # Self for content
            "type": "POST_CONTENT", # Updated per TransactionType enum
            "payload": payload_data,
            "amount": 0,
            "fee": 0,
            "timestamp": timestamp,
            "nonce": nonce,
            "sender_public_key": self.wallet_manager.public_key
        }
        
        # Construct signable data exactly as TransactionModel.getSignableData()
        # { tx_id, from_wallet, to_wallet, type, payload, amount, fee, timestamp, nonce, valid_until, sender_public_key }
        signable_dict = {
            "tx_id": "", # Server generates ID, but signature might need to verify original data. 
            # Actually, standard is server validates, if server generates ID, signature of ID is impossible.
            # Client must generate ID to sign it, OR sign the data *excluding* ID.
            # Let's rely on backend's relaxed check or specific content endpoint logic.
            # ContentService.ts usually handles this.
            # FALLBACK: Use simple JSON dump of payload for content if API supports it.
            # But let's look at what we did before: f"CONTENT:..."
            # The backend TransactionModel.ts uses JSON.stringify of the whole object.
            # We will try to mimic it.
             "tx_id": "",
             "from_wallet": tx['from_wallet'],
             "to_wallet": tx['to_wallet'],
             "type": tx['type'],
             "payload": tx['payload'],
             "amount": tx['amount'],
             "fee": tx['fee'],
             "timestamp": tx['timestamp'],
             "nonce": tx['nonce'],
             # "valid_until": undefined, 
             "sender_public_key": tx['sender_public_key']
        }
        
        # Python json.dumps with separators=(',', ':') compacts it like JS JSON.stringify
        signable_data = json.dumps(signable_dict, separators=(',', ':'))
        
        signature = self.wallet_manager.sign(signable_data)
        if not signature:
            messagebox.showerror("Error", "Signing failed")
            return
            
        tx["sender_signature"] = signature
        
        # Send
        res = self.explorer_client.post_content(tx)
        if "error" in res:
            messagebox.showerror("Failed", str(res))
        else:
            messagebox.showinfo("Success", "Tweet posted!")
            self.entry_post.delete("1.0", tk.END)
            self.refresh_feed()
            
    def send_coins(self):
        to_wallet = self.entry_to.get().strip()
        try:
            amount = float(self.entry_amount.get().strip())
        except:
            messagebox.showerror("Error", "Invalid Amount")
            return

        if not self.wallet_manager.private_key:
            messagebox.showerror("Error", "Wallet not loaded")
            return
            
        timestamp = int(time.time() * 1000)
        nonce = timestamp
        fee = 500 # Estimate
        
        tx = {
            "tx_id": "",
            "from_wallet": self.wallet_manager.public_key,
            "to_wallet": to_wallet,
            "type": "TRANSFER",
            "payload": {},
            "amount": amount,
            "fee": fee,
            "timestamp": timestamp,
            "nonce": nonce,
            "sender_public_key": self.wallet_manager.public_key
        }
        
        signable_dict = {
             "tx_id": "",
             "from_wallet": tx['from_wallet'],
             "to_wallet": tx['to_wallet'],
             "type": tx['type'],
             "payload": tx['payload'],
             "amount": tx['amount'],
             "fee": tx['fee'],
             "timestamp": tx['timestamp'],
             "nonce": tx['nonce'],
             "sender_public_key": tx['sender_public_key']
        }
        
        signable_data = json.dumps(signable_dict, separators=(',', ':'))
        signature = self.wallet_manager.sign(signable_data)
        
        if not signature:
             messagebox.showerror("Error", "Signing failed")
             return

        tx["sender_signature"] = signature
        
        res = self.explorer_client.send_transfer(tx)
        if "error" in res:
             messagebox.showerror("Transaction Failed", f"Error: {res.get('error')}")
        else:
             messagebox.showinfo("Success", f"Sent {amount} LT to {to_wallet[:8]}...!")
             self.entry_to.delete(0, tk.END)
             self.entry_amount.delete(0, tk.END)

    def refresh_feed(self):
        feed = self.explorer_client.get_feed()
        self.txt_feed.delete(1.0, tk.END)
        
        if not feed or "error" in feed:
            self.txt_feed.insert(tk.END, "No posts or node offline.")
            return

        for post in feed:
            try:
                user = post.get('author', 'Unknown')[:8]
                content = post.get('content', '')
                self.txt_feed.insert(tk.END, f"@{user}: {content}\n{'-'*20}\n")
            except:
                pass

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

    def run_node(self):
        if self.node_process:
            return
        
        # Check if port is in use
        port = self.entry_port.get()
        if self._is_port_in_use(port):
            if messagebox.askyesno("Port in Use", f"Port {port} is already in use.\n\nDo you want to FORCE STOP the existing node process and start a new one?"):
                self._kill_process_on_port(port)
                time.sleep(1) # Wait for cleanup
            else:
                return

        try:
            # Assume we are in tools/gui_miner/ and need to go up to project root
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
            
            # Use Shell=True for windows npm execution
            self.node_process = subprocess.Popen(
                ["npm", "start"], 
                cwd=project_root,
                shell=True
            )
            
            self.lbl_node_status.config(text="Node Status: RUNNING (PID: {})".format(self.node_process.pid), foreground="green")
            self.btn_run_node.config(state='disabled')
            self.btn_kill_node.config(state='normal')
            messagebox.showinfo("Success", "Node started successfully in background!")
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to start node: {str(e)}")

    def _is_port_in_use(self, port):
        """Check if port is open using netstat"""
        # Simple check using socket connect
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', int(port))) == 0

    def _kill_process_on_port(self, port):
        """Find PID on port and kill it (Windows)"""
        try:
            # Run netstat to find PID
            result = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True).decode()
            for line in result.splitlines():
                if "LISTENING" in line:
                    parts = line.split()
                    pid = parts[-1]
                    # Kill PID
                    subprocess.call(['taskkill', '/F', '/PID', pid])
        except:
            pass # Process might not exist or other error

    def stop_node(self):
        if self.node_process:
            # On Windows, killing shell=True process is tricky.
            # We will try taskkill
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(self.node_process.pid)])
            self.node_process = None
            self.lbl_node_status.config(text="Node Status: STOPPED", foreground="red")
            self.btn_run_node.config(state='normal')
            self.btn_kill_node.config(state='disabled')

    def update_stats(self):
        """Start background thread to fetch stats without freezing GUI"""
        threading.Thread(target=self._fetch_stats_background, daemon=True).start()
        
        # Schedule next update in 5 seconds
        self.root.after(5000, self.update_stats)

    def _fetch_stats_background(self):
        """Run network calls in separate thread"""
        try:
            # Fetch Stats
            stats = self.explorer_client.get_stats()
            
            # Fetch Balance
            balance_info = None
            if self.wallet_manager.public_key:
                balance_info = self.explorer_client.get_balance(self.wallet_manager.public_key)
            
            # Schedule UI update on main thread
            self.root.after(0, lambda: self._update_ui_with_data(stats, balance_info))
        except Exception as e:
            print(f"Background fetch error: {e}")

    def _update_ui_with_data(self, stats, balance_info):
        """Update UI widgets (Must run on main thread)"""
        # Update Stats Text
        self.txt_stats.delete(1.0, tk.END)
        
        is_online = True
        if "error" in stats:
            error_msg = str(stats["error"])
            if "WinError 10061" in error_msg or "Connection refused" in error_msg:
                self.txt_stats.insert(tk.END, "⚠️ NODE IS OFFLINE\n\nPlease click 'RUN LOCAL NODE' on the Dashboard and wait for it to start.")
                is_online = False
            else:
                self.txt_stats.insert(tk.END, f"Error: {error_msg}")
        else:
            self.txt_stats.insert(tk.END, str(stats))
        
        # Update Balance Label
        if is_online and balance_info:
            if "balance" in balance_info:
                self.lbl_balance.config(text=f"Balance: {balance_info['balance']} TRC")
            elif "error" in balance_info:
                self.lbl_balance.config(text=f"Balance: Error ({balance_info['error']})")
        else:
             self.lbl_balance.config(text="Balance: Node Offline")

class EnvManager:
    def __init__(self, env_path="../../.env"):
        self.env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), env_path))
        self.lines = []
        self.env_vars = {}
        self.load()

    def load(self):
        self.lines = []
        self.env_vars = {}
        if os.path.exists(self.env_path):
            with open(self.env_path, 'r', encoding='utf-8') as f:
                self.lines = f.readlines()
                
            for line in self.lines:
                stripped = line.strip()
                if stripped and not stripped.startswith('#'):
                    try:
                        if '=' in stripped:
                            key, val = stripped.split('=', 1)
                            self.env_vars[key.strip()] = val.strip()
                    except:
                        pass

    def get(self, key, default=""):
        return self.env_vars.get(key, default)

    def set(self, key, value):
        self.env_vars[key] = value
        # Update lines
        updated = False
        new_lines = []
        for line in self.lines:
            stripped = line.strip()
            if stripped and not stripped.startswith('#') and '=' in stripped:
                k, v = stripped.split('=', 1)
                if k.strip() == key:
                    new_lines.append(f"{key}={value}\n")
                    updated = True
                    continue
            new_lines.append(line)
        
        if not updated:
            if new_lines and not new_lines[-1].endswith('\n'):
                new_lines.append('\n')
            new_lines.append(f"{key}={value}\n")
            
        self.lines = new_lines

    def save(self):
        with open(self.env_path, 'w', encoding='utf-8') as f:
            f.writelines(self.lines)

if __name__ == "__main__":
    root = tk.Tk()
    app = MiningApp(root)
    root.mainloop()
