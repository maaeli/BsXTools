import React, { Component } from 'react';

import PropTypes from 'prop-types';
import classNames from 'classnames';
import caman from './caman.svg'
import {fabric} from 'fabric';
import {Button} from 'react-bootstrap';

import './App.css';

var colormap = require('colormap')
const colormapoptions = {
       colormap: "jet",   // pick a builtin colormap or add your own
       nshades: 255 ,      // how many divisions
       format: "rgb",     // "hex" or "rgb" or "rgbaString"
       alpha: 1  ,        // set an alpha value or a linear alpha mapping [start, end]
}
const cg = colormap(colormapoptions);


const color = (bw,cg) => cg[Math.floor((colormapoptions.nshades-1)*bw/255)]


const padding = 0;
const canvasSize = 300;


class App extends Component {

  constructor(props){
     super(props)

     this.refs = {
       //Fcanvas: None
     };

     this.state = {drawing: "None",
                   objectUnderCreation: [],
                   MaskObjects: [],
                  };

     this.createImg = this.createImg.bind(this);
     //this.onLoadData = this.onLoadData.bind(this);
     this.LoadData = this.LoadData.bind(this);
     this.transformData = this.transformData.bind(this);
     this.zoomSelect = this.zoomSelect.bind(this);
     this.addPolygonStart = this.addPolygonStart.bind(this);
     this.canvasClick = this.canvasClick.bind(this);
     this.canvasDblClick = this.canvasDblClick.bind(this);
  }

  zoomSelect() {
    const sel = this.refs.setzoom;

    const canvas = this.refs.Fcanvas;
    const newZoom = sel.value/(100);
    try {
      canvas.setZoom(newZoom);
    }
    catch(err) {
        console.log(err);
    }
    canvas.setHeight(canvasSize*newZoom);
    canvas.setWidth(canvasSize*newZoom);
  }


  LoadData(img) {
    console.log(img);
    const width = img.clientWidth;
    const height = img.clientHeight;
    const canvasin = this.refs.inputcanvas
    const ctx = canvasin.getContext("2d")
    ctx.drawImage(img,0,0, width,height, 0,0, width,height);
    const imgData = ctx.getImageData(0, 0, canvasin.width, canvasin.height);
    const imgWidth = imgData.width;
    const imgHeight = imgData.height;
    var bwdata = []
    for (let i = 0; i < imgData.data.length; i += 4) {
      bwdata[i/4] =   (imgData.data[i]+imgData.data[i+1]+imgData.data[i+2])/3;
    }
    //console.log(bwdata);
    if (imgWidth*imgHeight > 0) {
        const newImg = this.transformData(bwdata, imgWidth, imgHeight);
        this.createImg(newImg);
    }
  }

  canvasClick(options) {
    const canvas = this.refs.Fcanvas;
    console.log(options.pointer);
    console.log(options.absolutePointer);
    console.log(options);

    switch(this.state.drawing) {
       case "polygon":
         const newPoint = options.absolutePointer;
         if (this.state.objectUnderCreation.length > 0) {
             const lastPoint = this.state.objectUnderCreation[this.state.objectUnderCreation.length-1]
             const segment = new fabric.Line([lastPoint.x, lastPoint.y, newPoint.x, newPoint.y],
                                     {fill: 'red',
                                     stroke: 'red',
                                     strokeWidth: 5,
                                     selectable: false,
                                     evented: false,});
              canvas.add(segment);
         };
         this.setState(prevState => ({
            objectUnderCreation: [...prevState.objectUnderCreation, newPoint]
          }));
          console.log(this.state.objectUnderCreation);

         break;
       default:
         break;
     }
  }

  canvasDblClick(options) {
    const canvas = this.refs.Fcanvas;


    switch(this.state.drawing) {
       case "polygon":
         const newObject = this.state.objectUnderCreation;
         if (newObject.length > 2) {
           const polygon = new fabric.Polygon(newObject, {
                //left: 0,
                //top: 0,
                fill: 'purple',
                selectable: true,
                objectCaching: false,
              });
          //let's clean up the canvas ATTENTION: this assumes no other lines!
           canvas.forEachObject(function(obj){
             if(obj.type === 'line'){
                      canvas.remove(obj);
                  }
              });
           canvas.add(polygon);

           this.setState(prevState => ({
                drawing: "None",
                objectUnderCreation: [],
                MaskObjects: [...prevState.MaskObjects, polygon],
            }));
         }
         else {
           //Here, we should throw a notice
         };

         break;
       default:
         break;
     }
  }

  transformData(bwdata, width, height){

    var canvasin=this.refs.inputcanvas;
    const ctx = canvasin.getContext("2d")
    var data = [];
    for (let i = 0; i < bwdata.length; i += 1) {
      let rgb = color(bwdata[i],cg);
      //let rgb = [bwdata[i],0,0];

      data[4*i] = rgb[0];
      data[4*i + 1] = rgb[1];
      data[4*i + 2] = rgb[2];
      data[4*i + 3] = 254;
    }
    console.log(data);

    var idata = ctx.createImageData(width, height);
    idata.data.set(data);
    ctx.putImageData(idata, 0, 0);
    var image=new Image();
    image.src=canvasin.toDataURL();
    return image;
  }

createImg(img)  {

  const canvas = new fabric.Canvas(this.refs.canvas, {
    width: this.refs.canvas.clientWidth,
    height: this.refs.canvas.clientHeight
  });
  this.refs.Fcanvas = canvas;
  canvas.calcOffset()

  const cImg = new fabric.Image(img, {
     left: padding,
     top: padding,
     angle: 0,
     selectable: false,
  });

   canvas.add(cImg);

   canvas.on('mouse:down', this.canvasClick);
   canvas.on('mouse:dblclick', this.canvasDblClick);

}

componentDidMount() {


  const img = this.refs.inputimage
  //img.onload = this.LoadData(img);
  this.LoadData(img);
}

  addPolygonStart() {
      this.setState({drawing: "polygon"});
  }

  render() {

    return (
      <div className="App">
        <div className="navbar">
             <ul className="navbar-nav mr-auto">
              <label form="sel1">Select Zoom:</label>
              <select  ref="setzoom" onChange={this.zoomSelect}>
                <option>100</option>
                <option>300</option>
                <option>600</option>
              </select>
              </ul>
          </div>
        <table>
          <tbody>
            <tr>
              <td>
                <div ref="canvascontainer"  className="canvascontainer" >

                  <canvas ref="canvas" className="mainCanvas" width={canvasSize} height={canvasSize}  />

                </div>
              </td>
              <td>
                <Button onClick={this.addPolygonStart}> Add Polygon</Button>
              </td>
            </tr>
          </tbody>
        </table>
        <canvas ref="inputcanvas" width={640} height={425}/>
        <img ref="inputimage" src={caman}  alt=""  />
      </div>
    );
  }
}

export default App;
