#!/usr/bin/env python
# coding: utf-8

# In[36]:


import requests
import pandas as pd 
import json
import dash_table

from jupyter_dash import JupyterDash
import dash_html_components as html
from dash.dependencies import Input, Output, State
import dash_core_components as dcc
import dash_bootstrap_components as dbc
import flask 
import os
import base58
import plotly.express as px

# Memo Parser provided by 
# Gareth Davies @ MinaExplorer.com
def memo_parser(memo):
    """Decode the memo output"""
    decoded = base58.b58decode(memo)
    decoded = decoded[3:-4]
    output = decoded.decode("utf-8", "ignore")
    return output.strip()

def get_price(): 
    url = "https://api.coingecko.com/api/v3/simple/price?ids=mina-protocol&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true"
    r = requests.get(url)
    json_data = json.loads(r.text)
    return json_data["mina-protocol"]["usd"]

def get_providers():
    url = "https://api.staketab.com/mina/get_providers"
    r = requests.get(url)
    json_data = json.loads(r.text)
    df_data = json_data["staking_providers"]
    
    df = pd.DataFrame(df_data)
    return df
    
def get_data(all=False):
    if all:
        query = """
        query AllTransactions {
  transactions(query: {canonical: true, receiver: {publicKey: "B62qm7vP2JPj1d8XDmGUiv3GtwAfzuaxrdNsiXdWmZ7QqXZtzpVyGPG"}}, sortBy: BLOCKHEIGHT_DESC, limit: 10000) {
    from
    fee
    memo
    hash
    amount
    blockHeight
  }
}
"""
    else:
        query = """query NoMemos {
  transactions(query: {canonical: true, receiver: {publicKey: "B62qm7vP2JPj1d8XDmGUiv3GtwAfzuaxrdNsiXdWmZ7QqXZtzpVyGPG"}, OR: [{memo: "E4YM2vTHhWEg66xpj52JErHUBU4pZ1yageL4TVDDpTTSsv8mK6YaH"}, {memo: "E4YVe5YCtgSZuaBo1RiwHFWqtPzV6Eur8xG6JnbzEigit5nZKobQG"}, {memo: "E4YPMFGbXxurEKfdfxFYvLmzivqyZtH65z4CbnAbVqJRiQkDtNu8J"}]}, sortBy: BLOCKHEIGHT_DESC, limit: 10000) {
    id
    from
    to
    fee
    memo
    hash
    amount
    blockHeight
  }
}
"""    
    url = 'https://graphql.minaexplorer.com'
    r = requests.post(url, json={'query': query})
    
    json_data = json.loads(r.text)
    
    df_data = json_data["data"]["transactions"]
    
    
    df = pd.json_normalize(df_data, sep="_")
    df["fee"] = df.fee.map(lambda x: x/ (10 ** 9))
    df["amount"] = df.amount.map(lambda x: x/ (10 ** 9))
    return df

def generate_table(df):
    return dash_table.DataTable(
        id='table',
        columns=[
            {
                "id": "amount", 
                "name": "Amount Sent",
            },
            {
                "id": "fee", 
                "name": "Fee Paid",
            },
            {
                "id": "to", 
                "name": "Receiving Address",
            },
            {
                "id": "from", 
                "name": "Sending Address",
            },
            {
                "id": "blockHeight", 
                "name": "Block Height",
            },
            {
                "id": "hash", 
                "name": "Transaction Hash",
            }
        ],
        style_cell={
            'minWidth': '50px', 'width': '50px', 'maxWidth': '100%',
            'whiteSpace': 'normal'
        },
        style_table={'overflowX': 'auto'},
        sort_action='native',
        sort_by=[
            {
                'column_id':'blockHeight',
                'direction': 'desc'
            }
        ],
        data=df.to_dict('records'),
        page_size=10,
        )


# In[ ]:


app = JupyterDash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP])


app_copy = '''
# MINA Exchange Deposit Mistakes

### The Problem

The [MINA Validator Community](https://docs.google.com/forms/d/e/1FAIpQLSf7l_Qg-lZ-5rldls6RzO759frMPo8f3IDax5VCHNZPBgWkpg/viewform) has recognized a pattern of users incorrectly attempting to send $MINA between exchanges. Certain exchanges, like [Gate.io](https://www.gate.io/), share deposit addresses in order to cut down on the network-imposed 1-$MINA account creation fee. As such, they require a Mina deposit to be pre-authorized, implementing this via a _challenge string_ that must be passed through the `memo` field in the transaction. 

Many exchanges, like [CoinList](https://coinlist.co/), do not support the use of the `memo` field in outbound transactions. Thus, users who send $MINA from an exchange like CoinList _directly_ to an exchange like Gate.io, run the risk of their funds being lost or mis-catagorized.

### Why is this happening? 

CoinList and other exchanges like it do not support users setting the `memo` field in outgoing transactions.

### How do I get my funds back?!

This, obviously, is a huge drag, and based on the data in the table below, it happens increasingly often. 

Gate.io is advising users to provide proof of ownership of funds via screenshot or email documentation. See the below quoted email response from Gate.io, sent to a user, for more information: 

```
Hi,

Memo is required, while this transaction didn't include a memo.
We can help to manually credit for you, the following information are required:
1. Take a screenshot (in JPG or PNG format) of the withdrawal record from your sending party. (kindly include the whole screen)
2. Kindly make another deposit by using the same sender exchange or wallet, any coin and amount are OK, and be sure to include your memo this time. After successfully sent, copy/paste the transaction hash of this new deposit and also provide a screenshot (in JPG or PNG format); in the screenshot, the previous transaction record and the new transaction record shall be in the same page.
3.If you transfferred it from coin list or the sending party do not have summarized withdrawal record features, kindly provide us the screenshot of the email notification which the sending party inform you the transaction was sent successfully

-----Gate.io Support
```

Before taking the recommended actions, it is highly recommended that you make a ticket with Gate.io **first** before doing anything.

### How can I avoid this happening to me?

Currently, the only available work-around is to create a new wallet via a software wallet like [Clorio](https://clor.io), receive your funds from coinlist, then send your funds along to Gate.io **with the correct memo(!)**. 

Note: Sushi Validator is unaffiliated with the developers of the Clorio wallet, we just like it.

### Common mistakes: 

The following list is all known memos that do not match the Gate.io format, and the number of times they have occured. 

```
{
  "": 1722,
  "memo": 75,
  "003083c83c8fdbf9a9e": 1,
  "003b207af357b11f ": 1,
  "0027f63976e790a": 1,
  "ID gate.io 5748719": 1
}
```


_The below table contains transactions being sent to the Gate.io deposit address with either a blank memo or the word "`memo`"._


'''

footer_copy = '''
This tool is provided by 🍣 [Sushi Validator](https://www.sushivalidator.com).

Chain data is sourced _live_ from [Mina Explorer](https://minaexplorer.com) and [Stake Tab](https://mina.staketab.com).

Pricing data from [CoinGecko](https://www.coingecko.com).
'''

df = get_data()
total_stuck_mina = df['amount'].sum()
price = get_price()
histogram = px.histogram(df, x="blockHeight", title="Transaction Frequency")

app.title = "MINA Exchange Mistakes"
app.layout= html.Div(className="container", children=[
    html.Div(className="row", children=[
        html.Div(className="col-xl-1"),
        html.Div(className="col-xl", children=[
            dcc.Markdown(app_copy)
        ]),
        html.Div(className="col-xl-1")
    ]),
    html.Div(className="row justify-content-md-center", children=[
        html.Div(className="col-xl-3 card mr-5", children=[
            html.Div(className="card-body", children=[
                html.H6(className="card-title", children=[
                    f"Total Stuck Funds:"
                ]),
                html.H5(children=[
                   f"{total_stuck_mina:,.{3}f} $MINA"
                ],style={
                     "textAlign": "center"
                })
            ]),
        ]),
        html.Div(className="col-xl-3 card mr-5", children=[
            html.Div(className="card-body", children=[
                html.H6(className="card-title", children=[
                    f"Market Price of Funds:"
                ]),
                html.H4(children=[
                   f"${price * total_stuck_mina:,.{3}f}"
                ],style={
                     "textAlign": "center"
                }),
                html.Small(className="card-subtitle", children=[
                   f"Market Rate: ${price}" 
                ]),
            ]),
        ]),
        html.Div(className="col-xl-3 card", children=[
            html.Div(className="card-body", children=[
                html.P(children=[
                    f"Total Transactions:"
                ]),
                html.H2(children=[
                   f"{len(df.index):,}"
                ],style={
                     "textAlign": "center"
                })
            ]),
        ])
    ]),
    
    html.Hr(),
    html.Div(className="row", children=[
        html.Div(className="col-xl-2"),
        html.Div(className="col-xl", children=[
            html.Div(id="table-container", children=[
                generate_table(df)
            ]),
        ]),
        html.Div(className="col-xl-2")
    ]),
    html.Div(className="row", children=[
        html.Button(id='refetch-button', className=".mt-2", n_clicks=0, children='Refetch Data'),
    ]),
    html.Div(className="row", children=[
        dcc.Graph(id="histogram", className="mx-auto", figure=histogram)
    ]),
    html.Div(id="footer", className="row", children=[
        html.Div(className="col-xl", 
                 style={
                     "textAlign": "center"
                 },
                 children=[
            dcc.Markdown(footer_copy)
        ])
    ])
])

# For Gunicorn
server = app.server

@server.route('/_favicon.ico')
def favicon():
    return flask.send_from_directory(os.path.join("./", 'static'),
                                     'favicon.ico')

@app.callback(Output('table-container', 'children'),
              Input('refetch-button', 'n_clicks')
)
def refetch_data(n_clicks):
    df = get_data()
    return generate_table(df)

if __name__ == "__main__":
    app.run_server(mode="jupyterlab", debug=True)


# In[93]:


# from collections import Counter


# transactions=get_data(all=True)
# results = []
# for memo in transactions["memo"]: 
#     memo_raw = memo_parser(memo)
#     memo_parsed = memo_raw.replace("\x00", "")
#     pattern = re.compile("^[a-f0-9]{16}$")
#     match = pattern.search(memo_parsed)
#     if not match: 
#         results.append(memo_parsed)

# len(results)
# count = Counter(results)
# print(json.dumps(count, indent=2))

