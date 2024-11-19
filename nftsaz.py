import os
import sys
import json
import time
import subprocess

# Ensure required libraries are installed
def install_requirements():
    try:
        import requests  # Check if requests is already installed
    except ImportError:
        print("Required library 'requests' is not installed. Installing now...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("Installation completed. Restarting script...")
        os.execv(sys.executable, ["python"] + sys.argv)

# Call the function to ensure requirements
install_requirements()

# Proceed with the actual script
import requests

# File to store the address
FILE_NAME = "address.json"
URL = "https://faucet.testnet.humanity.org/api/claim"

def save_address(address):
    """Save the address to a file."""
    with open(FILE_NAME, "w") as file:
        json.dump({"address": address}, file)

def load_address():
    """Load the address from the file."""
    if not os.path.exists(FILE_NAME):
        return None
    with open(FILE_NAME, "r") as file:
        data = json.load(file)
        return data.get("address")

def post_address(address):
    """Post the address to the API."""
    payload = {"address": address}
    try:
        response = requests.post(URL, json=payload)
        response.raise_for_status()  # Raise an error for HTTP codes 4xx or 5xx
        return response.json()
    except requests.RequestException as e:
        print(f"Error: {e}")
        return None

def main():
    # Get the address from the user if not already saved
    address = load_address()
    if not address:
        address = input("Enter your Ethereum address: ")
        save_address(address)
        print("Address saved successfully!")

    print(f"Using address: {address}")

    # Main loop to post the address every minute
    while True:
        print("Sending request...")
        response = post_address(address)
        if response and "msg" in response:
            if "Txhash" in response["msg"]:
                print(f"Success! {response['msg']}")
            else:
                print(f"Response received: {response['msg']}")
        else:
            print("Failed to send request or invalid response.")
        
        time.sleep(60)  # Wait for 1 minute

if __name__ == "__main__":
    main()
