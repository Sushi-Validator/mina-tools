# Required imports
import os
from flask import Flask, request, jsonify
from firebase_admin import credentials, firestore, initialize_app, db

# Env Vars
environment = os.environ.get("ENV", "DEV")
db_url = os.environ.get("DB_URL", "https://sv-mina-forks-default-rtdb.firebaseio.com/")
port = int(os.environ.get("PORT", 8080))

# Initialize Flask app
app = Flask(__name__)

# Initialize Firestore DB

if environment == "DEV":
    cred = credentials.Certificate('service_account.json')
    default_app = initialize_app(cred, options={
        'databaseURL': db_url
    })
else:
    default_app = initialize_app(options={
        'databaseURL': db_url
    })
client = firestore.client()
forks_ref = db.reference('forks')

@app.route('/forks', methods=['GET'])
def forks():
    """
        List all forks where len > min_length
    """
    try:
        # Check if ID was passed to URL query
        public_key = request.args.get('public_key', None)
        min_length = int(request.args.get('min_length', 2))
        updated_after = int(request.args.get('updated_after', 0))

        forks_query = forks_ref.order_by_child('length').start_at(min_length)
        matched_forks = forks_query.get()
        forks_list = []
        for fork_id in matched_forks:
            body = matched_forks[fork_id]
            body["id"] = fork_id
            forks_list.append(body)

        if updated_after > 0:
            generator = filter(lambda fork: int(fork["last_updated"]) >= updated_after, forks_list)
            forks_list = list(generator)
        
        if public_key: 
            generator = filter(lambda fork: public_key in fork["creators"] , forks_list)
            forks_list = list(generator)
        
        res = forks_list
        return jsonify(res), 200  

    except Exception as e:
        return f"An Error Occured: {e}"

if __name__ == '__main__':
    app.run(threaded=True, host='0.0.0.0', port=port)