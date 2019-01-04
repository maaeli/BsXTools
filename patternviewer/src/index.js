
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap/dist/css/bootstrap-theme.css';

import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

//import { Router, Route, browserHistory, IndexRoute } from 'react-router';



import App from './App';
import * as serviceWorker from './serviceWorker';

if (module.hot) {
  //Enable Webpack hot module replacement for reducers
 module.hot.accept();
}

ReactDOM.render(<App />, document.getElementById('root'));


// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
