#!/usr/bin/env python
# coding: utf-8

# In[2]:


import requests
import pandas as pd 
import json
import dash_table

from jupyter_dash import JupyterDash
import dash_html_components as html
from dash.dependencies import Input, Output, State
import dash_core_components as dcc
import dash_bootstrap_components as dbc


def get_providers():
    url = "https://api.staketab.com/mina/get_providers"
    r = requests.get(url)
    json_data = json.loads(r.text)
    df_data = json_data["staking_providers"]
    
    df = pd.DataFrame(df_data)
    return df
    
def get_data():
    query = """query ExpensiveTransactions {
  transactions(query: {fee_gt: 10000000000, canonical: true}, sortBy: FEE_DESC) {
    hash
    from
    to
    block {
      creator
      blockHeight
    }
    fee
  }
}
"""
    providers = get_providers()
    
    url = 'https://graphql.minaexplorer.com'
    r = requests.post(url, json={'query': query})
    json_data = json.loads(r.text)
    df_data = json_data["data"]["transactions"]
    df = pd.json_normalize(df_data, sep="_")
    df["fee"] = df.fee.map(lambda x: x/ (10 ** 9))
    
    res = pd.merge(df, providers, left_on=  ['block_creator'],
                   right_on= ['provider_address'], 
                   how = 'left')
    
    return res

def generate_table(df):
    return dash_table.DataTable(
        id='table',
        columns=[
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
                "id": "hash", 
                "name": "Transaction Hash",
            },
            {
                "id": "block_blockHeight", 
                "name": "Block Height",
            },
            {
                "id": "block_creator", 
                "name": "Block Creator",
            },
            {
                "id": "discord_username", 
                "name": "Block Producer Discord",
            }
        ],
        style_cell={
            'minWidth': '50px', 'width': '50px', 'maxWidth': '100%',
            'whiteSpace': 'normal'
        },
        style_table={'overflowX': 'auto'},
        sort_action='native',
        data=df.to_dict('records'),
        )


# In[3]:


app = JupyterDash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP])

app.index_string = '''<!DOCTYPE html>
<html>
<head>
    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-F9J1MV7T8E"></script>
    <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-F9J1MV7T8E');
    </script>
{%metas%}
<title>{%title%}</title>
{%favicon%}
{%css%}
</head>
<body>
{%app_entry%}
<footer>
{%config%}
{%scripts%}
{%renderer%}
</footer>
</body>
</html>
'''

app_copy = '''
# MINA Massive Fees

### The Problem

The [MINA Validator Community](https://docs.google.com/forms/d/e/1FAIpQLSf7l_Qg-lZ-5rldls6RzO759frMPo8f3IDax5VCHNZPBgWkpg/viewform) has recognized a pattern of new users sending delegation transactions with massive fees, >50000x the market rate for a transaction fee at times. 

### Why is this happening? 

This is likely a misunderstanding about the nature of a Mina Protocol delegation. Other PoS blockchains allow one to set the _voting power_ for a delegation in the number of tokens you would like to vote with. Users take this understanding and use the `fee` field to set this value, not realizing that the `fee` field in a transactions is the _transaction fee_ that is sent to the Block Producer creating the block that contains the transaction. 

### How do I get my funds back?!

This, obviously, is a huge drag, and based on the table below, it happens increasingly often. If this has happened to you, and you are lucky, the block producer that created the block that contains your transaction _might_ be willing to send back the funds due to it being an honest mistake. 

There _is_ precedent for this:
>> Gareth Davies of [Mina Explorer](https://minaexplorer.com), was the first one to _accidentally_ set a *massive* fee for a transaction in the early days of the Mina Mainnet. The original transaction was made [here](https://minaexplorer.com/transaction/CkpYhsJuLePGTHimk8KbWC3ATnEGebvNLdwBvR4HyHyKGNuQ1XXTS) and fortunately the Genesis Founding Member [Lex Prime](https://twitter.com/Lex__Prime) was the one to produce the block that contained Gareth's transaction. Upon being asked nicely, Lex was happy to return the funds and not ruin Gareth's day (as seen [here](https://minaexplorer.com/transaction/CkpZCejUMmhRxfvs1ycrg6oDT4wQmFuCtyeLZ38ETvefQeMHLMyK6), observe the memo on this transaction)! The Mina Validator Community is a pretty nice bunch of people, hopefully it works out for others who make this fatal error.

As it is, Gareth currently holds the record for highest fee paid on a transaction (so far!), lets hope it stays that way.


This dashboard was built to aid users in this situation, help them track down who the block producer might be, and help them get in touch _in the off chance_ they can get a refund. 
'''

footer_copy = '''
This tool is provided by 🍣 [Sushi Validator](https://sushivalidator.com).

Data is sourced _live_ from [Mina Explorer](https://minaexplorer.com) and [Stake Tab](https://mina.staketab.com). 
'''

df = get_data()
app.layout= html.Div(className="container", children=[
    html.Div(className="row", children=[
        html.Div(className="col-xl-1"),
        html.Div(className="col-xl", children=[
            dcc.Markdown(app_copy)
        ]),
        html.Div(className="col-xl-1")
    ]),
    html.Hr(),
    html.Div(className="row", children=[
        html.Div(className="col-xl-2"),
        html.Div(className="col-xl", children=[
            html.Div(id="table-container", children=[
                generate_table(df)
            ]),
            html.Button(id='refetch-button', className=".mt-3", n_clicks=0, children='Refetch Data'),
        ]),
        html.Div(className="col-xl-2")
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

@app.callback(Output('table-container', 'children'),
              Input('refetch-button', 'n_clicks')
)
def refetch_data(n_clicks):
    df = get_data()
    return generate_table(df)

if __name__ == "__main__":
    app.run_server(mode="jupyterlab", debug=True)


# In[6]:





# In[ ]:




