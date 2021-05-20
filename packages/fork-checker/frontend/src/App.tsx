/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import './App.css';
import $ from 'jquery';
import { Redirect, Route, BrowserRouter as Router, Switch } from 'react-router-dom';
import { ForkBrowser } from './pages/ForkBrowser';
import { SingleFork } from './pages/SingleFork';

// Fetch URL queries and their value by key
function GetParameter(parameter: String) {
  let url = window.location.search.substring(1);
  let urlVars = url.split('?');
  for (var i = 0; i < urlVars.length; i++) {
    // varName is an array, with index 0 being the key and 1 being the value
    let varName = urlVars[i].split('=');
    if (varName[0] === parameter) {
      // If the value of varName is undefined, return null, otherwise return the value
      return varName[1] === undefined ? null : decodeURIComponent(varName[1]);
    }
  }
  // Null if does not exist/match
  return null;
}

// Display fork details
// TODO: Refactor to match Update() workflow
function Details(parameter: any) {
  if (!parameter) {
    // Redirect should happen here if there is no fork at all
    return <Redirect to="/Index" />
  }
  // AJAX call to the API for a specific fork
  let API = 'https://fork-checker-api-iyrf2hryca-uw.a.run.app/fork/'
  $.ajax({
    url: API + parameter,
    async: true,
    dataType: 'json',
    success: function(data) {
      $(function() {
        console.log(data)
        if (data.length === 0 || data[0] === undefined) {
          // Malformed id will still successfully return an empty JSON, so redirect as though no parameter was given
          window.location.href = '/Index';
        }

        // Wrapper

        /*-----------\ /----------------\ /-------------\
        | Fork Name  | | Fork Producers | | Fork Losses |
        \------------/ \----------------/ \-------------/

        /-----------------------------------------------\
        |                  Block Hash           (V)     |
        |-----------------------------------------------|
        |                  Timestamp                    |
        |-----------------------------------------------|
        |    Creator (link to creator pages, StakeTab)  |
        |-----------------------------------------------|
        |             View on MinaExplorer              |
        \----------------------------------------------*/

        let forkWrapper = document.createElement("div");
        forkWrapper.className = "Fork-Wrapper";
        forkWrapper.id = data[0].id;
        let forkDetails = document.createElement("div");
        forkDetails.className = "Fork-Details";
        forkDetails.innerText = "Viewing Fork with latest block = " + data[0].latest + "\n Under Construction";
        forkWrapper.appendChild(forkDetails);
      });
      // Refresh(data.length);
    }
  });
}


// Main page
const Index = () => (
  <div className="App">
    <Router>
      <header className="App-header">
        <div id="Fork-Header">
          <div id="Logo">
          <img src="https://lithi.io/file/RiJn.webp" alt='sushi'></img>
          SUSHI VALIDATOR
          </div>
        </div>
        {/* <div id="Fork-Table">Loading...</div> */}
        {/* {Update(5, 604800)}  */}
      </header>
      <Switch>
        <Route exact path="/">
          <ForkBrowser />
        </Route>
        <Route path="/fork/:forkId">
          <SingleFork />
        </Route>
      </Switch>
      {/* <Route path="/fork" component={ Fork } />
      <Route path="/producer" component={ Producer } /> */}
    </Router>
  </div>
);

// Producer page
// Huge TODO
const Producer = () => {
  return (
    <div className="App">
      <header className="App-header">
      </header>
    </div>
  )
};

export default Index;
