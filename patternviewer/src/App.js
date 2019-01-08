import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {fabric} from 'fabric';
import {Button} from 'react-bootstrap';

import './App.css';

import openSocket from 'socket.io-client';
const socket = openSocket("http://0.0.0.0:8081");


/*This section is to be extended to allow a section of colormaps
Also, negative values need to be handled depending on the chosen map*/
var colormap = require('colormap')
const colormapoptions = {
       colormap: "jet",   // pick a builtin colormap or add your own
       nshades: 255 ,      // how many divisions
       format: "rgb",     // "hex" or "rgb" or "rgbaString"
       alpha: 1  ,        // set an alpha value or a linear alpha mapping [start, end]
}
const cg = colormap(colormapoptions);
const color = (bw,cg) => (bw < 0)
    ? [0,0,0]
    : cg[Math.floor((colormapoptions.nshades-1)*bw/255)]


const padding = 10;
const canvasHeight = 330;
const canvasWidth = 560;


class App extends Component {

  constructor(props){
     super(props)

     this.state = {imageScale: 1,
                   imageOffsetX: 0,
                   imageOffsetY: 0,
                   drawing: "None",
                   objectUnderCreation: [],
                   MaskObjects: [],
                   zoom: 100,
                   //limits for intensity display
                   maximumInt: 1000,
                   minimumInt: 0,
                   logInt: false,
                   rawData: {},
                  };

     this.createImg = this.createImg.bind(this);
     //this.onLoadData = this.onLoadData.bind(this);
     this.LoadData = this.LoadData.bind(this);
     this.transformData = this.transformData.bind(this);
     this.zoomSelect = this.zoomSelect.bind(this);
     this.addPolygonStart = this.addPolygonStart.bind(this);
     this.canvasClick = this.canvasClick.bind(this);
     this.canvasDblClick = this.canvasDblClick.bind(this);
     this.requestData = this.requestData.bind(this);
     this.editPolygon = this.editPolygon.bind(this);
     this.activateCanvasObject = this.activateCanvasObject.bind(this);
     this.moveCanvasObject = this.moveCanvasObject.bind(this);
     this.polygonPointMoved = this.polygonPointMoved.bind(this);
     this.leaveEditingPolygon = this.leaveEditingPolygon.bind(this);
  }

  //Data relatefunctions
  requestData() {
    console.log("in requestData")
    socket.on('data2d', (data2d) => {
      console.log(data2d.width, data2d.height);
      const newImg = this.transformData(data2d.data, data2d.width, data2d.height);
      this.createImg(newImg);
      this.setState(prevState => ({
         rawData: {data: data2d.data, width: data2d.width, height: data2d.height}
       }));
    });
    socket.emit('data2d');
  }

  LoadData(img) {

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
    if (imgWidth*imgHeight > 0) {
        const newImg = this.transformData(bwdata, imgWidth, imgHeight);
        this.createImg(newImg);
    }
  }

  transformData(bwdata, width, height){
    var canvasin=this.refs.inputcanvas;
    canvasin.width = width;
    canvasin.height = height;
    const ctx = canvasin.getContext("2d");
    //let max = Math.max(bwdata);
    var data = [];
    for (let i = 0; i < bwdata.length; i += 1) {
      let intensity = bwdata[i];
      intensity = (0 < intensity && intensity <= this.state.minimumInt) ? 0 : intensity
      intensity = (intensity >= this.state.maximumInt) ? this.state.maximumInt : intensity
      intensity = 255*(intensity - this.state.minimumInt)/(this.state.maximumInt - this.state.minimumInt)
      let rgb = color(intensity,cg);
      try {
        data[4*i] = rgb[0];
        data[4*i + 1] = rgb[1];
        data[4*i + 2] = rgb[2];
        data[4*i + 3] = 254;
      }
      catch (err) {
        console.log(bwdata[i], rgb);
      }
    }
    var idata = ctx.createImageData(width, height);
    idata.data.set(data);
    ctx.putImageData(idata, 0, 0);
    var image=new Image();
    image.src=canvasin.toDataURL();
    return image;
  }

  createImg(img)  {
    const canvas = this.canvas;

    canvas.calcOffset()

    const cImg = new fabric.Image(img, {
       angle: 0,
       selectable: false,
    });
    const scalingFactorW = canvas.width/img.width
    const scalingFactorH = canvas.height/img.height
    const scalingFactor = Math.min(scalingFactorW,scalingFactorH)
    //console.log(canvas.width);
    //console.log(img.width);


    cImg.set({
      scaleX: scalingFactor,
      scaleY: scalingFactor,
      left: (canvas.width - img.width*scalingFactor)/2,
      top: (canvas.height - img.height*scalingFactor)/2,
    });
    canvas.add(cImg);
    canvas.renderAll();


  }

  //Canvas actions

  activateCanvasObject(target) {
    try {
      //console.log(target.e.shiftKey);
        target.selected[0].selectedDo();
    }
    catch(err) {
      //It is quite probale that shiftSelectDo is not defined ;)
      console.log(err);
    }
  }


  moveCanvasObject(target) {
    try {
      //console.log(target.target)//.selected[0])
      target.target.moveDo();
    }
    catch(err) {
      console.log(err);
    }
  }

  canvasClick(options) {
    console.log(options.e);

    //console.log(options.pointer);
    //console.log(options.absolutePointer);
    try {
      var canvas = options.target.canvas;
    }
    catch(err) {
        console.log(err);
        return;
    }

    switch(this.state.drawing) {
       case "polygon":
         const newPoint = options.absolutePointer;
         if (this.state.objectUnderCreation.length > 0) {
             const lastPoint = this.state.objectUnderCreation[this.state.objectUnderCreation.length-1]
             const segment = new fabric.Line([lastPoint.x, lastPoint.y, newPoint.x, newPoint.y],
                                     {fill: 'red',
                                     stroke: 'white',
                                     strokeWidth: 1/canvas.getZoom(),
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
    try {
      var canvas = options.target.canvas;
    }
    catch(err) {
      console.log(err);
      return;
    }

    switch(this.state.drawing) {
       case "polygon":
         const newObject = this.state.objectUnderCreation;
         if (newObject.length > 3) {
           //the last point actually comes from this double-click, let's get rid of interval
           newObject.pop();

           const polygon = new fabric.Polygon(newObject, {
                //left: 0,
                //top: 0,
                fill: 'purple',
                selectable: true,
                objectCaching: false,
                lockMovementX: true,
                lockMovementY: true,
              });



          //let's clean up the canvas ATTENTION: this assumes no other lines!
           canvas.forEachObject(function(obj){
             if(obj.type === 'line'){
                      canvas.remove(obj);
                  }
              });
           canvas.add(polygon);
           canvas.renderAll();
           const polygonID = this.state.MaskObjects.length;
           this.setState(prevState => ({
                drawing: "None",
                objectUnderCreation: [],
                MaskObjects: [...prevState.MaskObjects, polygon],
            }));
            polygon.selectedDo = () => this.editPolygon(polygonID);
         }
         else {
           //Here, we should throw a notice
         };

         break;
       default:
         break;
     }
  }

  //Canvas object actions



  editPolygon(id) {
    //TODO: check if any other Poly is in editing mode and leave
    //how do we leave editing mode???
    console.log("Edit poly");
    const polygon = this.state.MaskObjects[id];

    const points = polygon.points;
      for (let pointnr in points) {
        let point = points[pointnr];
        console.log(point);
        let circle = new fabric.Circle({
          radius: 2/this.canvas.getZoom(),
          fill: 'white',
          left: point.x,
          top: point.y,
          originX: 'center',
          originY: 'center',
          hasBorders: false,
          hasControls: false,
          //name: index
        });
        
      //to implement: when a circle is dragged, the polygon and all other cirlces are deselcted, the other cirlces disappear
      //to implement: when a circle is no longer dragged, we return to the prvious state
      circle.moveDo = () => this.polygonPointMoved(id,pointnr,circle);
      this.canvas.add(circle);
    }
    this.canvas.renderAll();
    console.log(polygon);
    return true;
  }

  polygonPointMoved(id, pointnr, circle) {
      console.log(pointnr);
      const objects = this.state.MaskObjects;
      const polygon = objects[id];
      const points = polygon.points;
      console.log(points);
      points[pointnr] = circle.getCenterPoint();
      console.log(points);
      const updatedPolygon = new fabric.Polygon(points, {
           //left: 0,
           //top: 0,
           fill: 'purple',
           selectable: true,
           objectCaching: false,
           objectCaching: false,
           lockMovementX: true,
           lockMovementY: true,
        });
      updatedPolygon.selectedDo = () => this.editPolygon(id);
      objects[id] = updatedPolygon;
      this.setState({MaskObjects: objects});
  }

 //Canvas state functions
   addPolygonStart() {
       this.setState({drawing: "polygon"});
   }

   leaveEditingPolygon(id) {
     //first, we rmove any circle object
     const canvas = this.canvas;
     canvas.forEachObject(function(obj){
       if(obj.type === 'circle'){
                canvas.remove(obj);
            }
        });
        const polygon = this.state.MaskObjects[id];
        polygon.lockMovementX = false;
        polygon.lockMovementY = false;
   }

  zoomSelect(event, zoom) {
    //in the functions call from the zoom selector, zoom is e.target.value and
    //as o7 07/01/2019 a string!
    const sel = parseInt(zoom);
    this.setState({zoom: sel});
    const canvas = this.canvas;
    const newZoom = sel/(100);
    console.log(newZoom);
    const currentZoom = canvas.getZoom(newZoom);
    // We need to know the current postions of the scroll bars for proper centering
    const scroller = this.refs.canvascontainer;
    var newScrollLeft = 0;
    var newScrollTop = 0;

    //relative position of the beginning of the thumb, adjusted by half the thumbsize
    const oldScrollLeft = (scroller.scrollLeft + 0.5*scroller.clientWidth^2/scroller.scrollWidth)/scroller.scrollWidth ;
    const oldScrollTop = (scroller.scrollTop + 0.5*scroller.clientHeight^2/scroller.scrollHeight)/scroller.scrollHeight;

    //Check if we already have a scrollbar
    const noHscroll = (scroller.clientWidth > canvas.width);
    const noVscroll = (scroller.clientHeight > canvas.height);

    try {
      canvas.setZoom(newZoom);
    }
    catch(err) {
        console.log(err);
    }
    canvas.setHeight(canvas.height*newZoom/currentZoom);
    canvas.setWidth(canvas.width*newZoom/currentZoom);

    canvas.calcOffset();

    const scrollThumbLeft = scroller.clientWidth^2/scroller.scrollWidth;
    const scrollThumbTop = scroller.clientHeight^2/scroller.scrollHeight;

    if (canvas.width > scroller.clientWidth) {
      if (noHscroll) {
        //there is no scroll-bar yet, go to center by default

        newScrollLeft = (scroller.scrollWidth - scrollThumbLeft)/2;
      }
      else {
        newScrollLeft = oldScrollLeft*scroller.scrollWidth - scrollThumbLeft/2
      }
      scroller.scrollLeft = newScrollLeft;
    }
    if (canvas.height > scroller.clientHeight) {
      if (noVscroll) {
        //there is no scroll-bar yet, go to center by default
        newScrollTop = (scroller.scrollHeight - scrollThumbTop)/2;
      }
      else {
        newScrollTop = oldScrollTop*scroller.scrollHeight - scrollThumbTop/2;
      }
      scroller.scrollTop = newScrollTop;
    }
    event.preventDefault();
  }



componentDidMount() {
  const canvas = new fabric.Canvas(this.refs.canvas, {
    width: this.refs.canvas.clientWidth,
    height: this.refs.canvas.clientHeight
  });
  this.canvas = canvas;
  canvas.on("selection:created", this.activateCanvasObject);
  canvas.on("selection:updated", this.activateCanvasObject);
  canvas.on('object:moving',this.moveCanvasObject);
  canvas.on('mouse:down', this.canvasClick);
  canvas.on('mouse:dblclick', this.canvasDblClick);
  canvas.hoverCursor = 'default';
  this.requestData();

  //const img = this.refs.inputimage
  //this.LoadData(img);
}


  render() {
    return (
      <div className="App">
        <div className="navbar">
             <ul className="navbar-nav mr-auto">
              <label form="sel1">Select Zoom:</label>
              <select  ref="setzoom"
                       value = {this.state.zoom}
                       onChange={(e) => {
                         this.zoomSelect(e,e.target.value);
                       }}>
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
                <div ref="canvascontainer"  className="canvascontainer"
                     style={{padding: padding,
                             width: canvasWidth + 2.5*padding,
                             height: canvasHeight + 2.5*padding}}>
                    <canvas ref="canvas" className="mainCanvas"
                            style={{width: canvasWidth,
                                    height: canvasHeight}}/>
                </div>
              </td>
              <td>
                <Button onClick={this.addPolygonStart}> Add Polygon</Button>
              </td>
            </tr>
          </tbody>
        </table>
        <canvas ref="inputcanvas" width={canvasWidth} height={canvasHeight}
                className="hidden"/>
      </div>
    );
  }
}




export default App;
