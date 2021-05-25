/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import './App.css';
import { Redirect, Route, BrowserRouter as Router, Switch } from 'react-router-dom';
import { ForkBrowser } from './pages/ForkBrowser';
import { SingleFork } from './pages/SingleFork';

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
      </header>
      <Switch>
        <Route exact path="/">
          <ForkBrowser />
        </Route>
        <Route path="/fork/:forkId">
          <SingleFork />
        </Route>
      </Switch>
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
