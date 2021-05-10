import React from 'react';
import './App.css';
import $ from 'jquery';
import { Redirect, Link, Route, BrowserRouter as Router } from 'react-router-dom';

// Big ugly monster, clean this up later
// TODO: Cleanup, sort output by timestamp, determine method for grabbing latest producer and displaying it
function Update(max: any) {
  // 'max' parameter dictates how many forks we want to display at a time
  let last_week = Math.floor((Date.now() / 1000) - 604800);
  let API = 'https://fork-checker-api-iyrf2hryca-uw.a.run.app/forks?';
  let DEFAULT_QUERY = 'updated_after=' + last_week + '&min_length=5'; // Get forks from within the past week that are length >= 5
  // jQuery AJAX - fetch might be a better fit (and is native), but AJAX is easy.
  $.ajax({
    url: API + DEFAULT_QUERY,
    async: true,
    dataType: 'json',
    success: function(data) {
      // Build a table containing our forks
      $(function() {
        // For each entry, add an entry showing the creator, timestamp, fork length, and lost rewards
        // Clickthrough should yield more complex information, this is just a brief overview and should be compact
        // HTML tables are ugly by default so I'm using a div, but this can be re-organized easily if this is a stupid idea
        let forkTable = document.createElement("div");
        forkTable.id = "Fork-Table";
        // Add each entry to its own div which will be contained within Fork-Table
        for (var i = 0; i < max; i++) {
          // Wrapper
          /*-----------------------------------------------*\
          | [TIMESTAMP]                                     |
          |-------------------------------------------------|
          | [LATEST FORK], BY [LATEST PRODUCER]             |
          |-------------------------------------------------|
          | [LENGTH] BLOCKS LONG, WITH [REWARDS] MINA LOST  |
          \*-----------------------------------------------*/

          let forkWrapper = document.createElement("div");
          forkWrapper.className = "Fork-Wrapper";
          forkWrapper.id = data[i].id;

          // Timestamp
          let forkTimestamp = document.createElement("div");
          forkTimestamp.className = "Fork-Timestamp";
          let timestamp = new Date(data[i].last_updated)
          let localTimestamp = timestamp.toLocaleDateString('us-EN') + " at " + timestamp.toLocaleTimeString('us-EN');
          forkTimestamp.innerText = localTimestamp;
          forkWrapper.appendChild(forkTimestamp);

          // Links
          let forkLinks = document.createElement("div");
          forkLinks.className = "Fork-Links";
          let forkLatestLink = document.createElement("a");
          let forkProducerLink = document.createElement("a");
          forkLatestLink.href = "/Fork?fork=" + data[i].id;
          forkLatestLink.innerText = data[i].latest;
          forkProducerLink.innerText = ", by Placeholder Producer";
          forkLinks.appendChild(forkLatestLink);
          forkLinks.appendChild(forkProducerLink);
          forkWrapper.appendChild(forkLinks);

          // Details
          let forkDetails = document.createElement("div");
          forkDetails.className = "Fork-Details";
          forkDetails.innerText = data[i].length + " blocks long, with " + data[i].rewards + " MINA lost."
          forkWrapper.appendChild(forkDetails);

          // Integration
          forkTable.appendChild(forkWrapper);
        };
        // Replace loading text with content
        $("#Fork-Table").replaceWith(forkTable);
      });
    }
  });
  // Display a loading message while we wait for the API call
  return (
    <>
      <div id="Fork-Header">Showing {max} forks from the past week:</div>
      <div id="Fork-Table">Loading...</div>
    </>
  );
}

// Fetch URL queries and their value by key
function GetParameter(parameter: any) {
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
// // TODO: add redirect if no fork query
function Details(parameter: any) {
  if (!parameter) {
    // Redirect should happen here if there is no fork at all
    return <Redirect to="/Index" />
  }
  // AJAX call to the API for a specific fork
  let API = 'https://fork-checker-api-iyrf2hryca-uw.a.run.app/forks?fork_id='
  $.ajax({
    url: API + parameter,
    async: true,
    dataType: 'json',
    success: function(data) {
      $(function() {
        if (data.length === 0 || data[0] == undefined) {
          // Malformed id will still successfully return an empty JSON, so redirect as though no parameter was given
          window.location.href = '/Index';
        }
        let forkWrapper = document.createElement("div");
        forkWrapper.className = "Fork-Wrapper";
        forkWrapper.id = data[0].id;
        let forkDetails = document.createElement("div");
        forkDetails.className = "Fork-Details";
        forkDetails.innerText = "Viewing Fork with latest block = " + data[0].latest + "\n Under Construction";
        forkWrapper.appendChild(forkDetails);
        $('#Fork-Details').replaceWith(forkWrapper);
      });
    }
  });
  // Loading...
  return (
    <>
      <div id="Fork-Details">Loading...</div>
    </>
  );
}

// Main page
const Index = () => (
  <div className="App">
    <Router>
      <Route path="/fork" component={ Fork } />
    </Router>
    <header className="App-header">
      {Update(5)}
    </header>
  </div>
);

// Fork page
const Fork = () => {
  let forkID = GetParameter('fork');
  return (
    <div className="App">
      <Router>
        <Route path="/index" component={ Index } />
      </Router>
      <header className="App-header">
        {Details(forkID)}
      </header>
    </div>
  )
};

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
