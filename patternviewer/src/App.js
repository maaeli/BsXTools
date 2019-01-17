import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {fabric} from 'fabric';
import {Button} from 'react-bootstrap';
import { Stage, Layer, Rect, Text, Line } from 'react-konva';
import { Image as Kimage } from 'react-konva';
//import Konva from 'konva';

import './App.css';

import io from 'socket.io-client';
const socket = io.connect("http://0.0.0.0:8081");



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


const padding = 0;
const scrollBarSize = 10;
const canvasHeight = 330;
const canvasWidth = 560;


class App extends Component {

  constructor(props){
     super(props)

     this.state = {imageScaleX: 1,
                   imageScaleY: 1,
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
                   posX: 0,
                   posY: 0,
                   intensity: 0,
                   image: null,
                   scrollX: padding,
                   scrollY: 0,
                   y: 0,
                   x: 0,
                   scrollBarLength: canvasHeight,
                   scrollBarWidth: canvasWidth,
                   imageWidth:  canvasWidth,
                   imageHeight:  canvasHeight,
                   lastClick: null,
                  };

     this.createImg = this.createImg.bind(this);
     this.transformData = this.transformData.bind(this);

     this.zoomSelect = this.zoomSelect.bind(this);
     this.addPolygonStart = this.addPolygonStart.bind(this);
     this.canvasMouseMove = this.canvasMouseMove.bind(this);
     this.canvasClick = this.canvasClick.bind(this);
     this.canvasDblClick = this.canvasDblClick.bind(this);
     this.requestData = this.requestData.bind(this);
     this.editPolygon = this.editPolygon.bind(this);
     this.polygonPointMoved = this.polygonPointMoved.bind(this);
     this.leaveEditingPolygon = this.leaveEditingPolygon.bind(this);
     this.verticalScroll = this.verticalScroll.bind(this);
     this.horizontalScroll = this.horizontalScroll.bind(this);
  }



  //Data relatefunctions
  requestData() {
    console.log("request data")
    socket.on('data2d', (data2d) => {

      this.setState(prevState => ({
         rawData: {data: data2d.data, width: data2d.width, height: data2d.height},
         imageWidth: data2d.width,
         imageHeight: data2d.height,
       }));
      const newImg = this.transformData(data2d.data, data2d.width, data2d.height);
      this.createImg(newImg);

    });
    socket.emit('data2d');
  }



  transformData(bwdata, width, height){
    var canvasin=this.refs.inputcanvas;
    canvasin.width = width;
    canvasin.height = height;
    const ctx = canvasin.getContext("2d");
    //let max = Math.max(bwdata);
    var data = new Uint8ClampedArray(bwdata.length*4);
    for (let i = 0; i < bwdata.length; i += 1) {
      let intensity = bwdata[i];
      intensity = (0 < intensity && intensity <= this.state.minimumInt) ? 0 : intensity
      intensity = (intensity >= this.state.maximumInt) ? this.state.maximumInt : intensity
      intensity = 255*(intensity - this.state.minimumInt)/(this.state.maximumInt - this.state.minimumInt)
      let rgb = color(intensity,cg);
      data[4*i] = rgb[0];
      data[4*i + 1] = rgb[1];
      data[4*i + 2] = rgb[2];
      data[4*i + 3] = 254;
    }
    var idata = ctx.createImageData(width, height);
    idata.data.set(data);
    ctx.putImageData(idata, 0, 0);
    var image=new Image();
    image.src=canvasin.toDataURL();
    return image;
  }

  createImg(img)  {
   const scalingFactorW = (canvasWidth-scrollBarSize)/img.width
   const scalingFactorH = (canvasHeight-scrollBarSize)/img.height
   const scalingFactor = 0.98*Math.min(scalingFactorW,scalingFactorH)
   const offsetX = Math.floor(canvasWidth - img.width*scalingFactor)/2 - scrollBarSize;
   const offsetY = Math.max(0,((canvasHeight - img.height*scalingFactor)/2 - scrollBarSize));
   img.width = img.width*scalingFactor;
   img.height = img.height*scalingFactor;

    this.setState(prevState => ({
      image: img,
      imageScaleX: img.width/this.state.rawData.width, //img.width is always int!
      imageScaleY: img.height/this.state.rawData.height, //img.width is always int!
      imageOffsetX: offsetX,
      imageOffsetY: offsetY,
     }));

  }

  //Canvas actions

  verticalScroll(delta) {
      const y = -canvasHeight * delta * this.state.zoom/100;
      this.setState(prevState => ({scrollY: delta, y: y}))

  }

  horizontalScroll(e) {
    const barWidth = this.state.scrollBarWidth;
    const availableWidth = canvasWidth - padding * 2 - barWidth;
    if (availableWidth > 0) {
      var delta = (e.target._lastPos.x - padding) / availableWidth;
      const x = -canvasWidth * delta * this.state.zoom/100;
      this.setState(prevState => ({scrollX: e.target._lastPos.x, x: x}))
    }
  }


  canvasMouseMove(event) {

      const posX = event.evt.layerX;
      const posY = event.evt.layerY;

      //starting at 1,1!
      const realX = (100*(posX-this.state.x)/this.state.zoom - this.state.imageOffsetX)/this.state.imageScaleX + 1;
      const realY = (100*(posY-this.state.y)/this.state.zoom - this.state.imageOffsetY)/this.state.imageScaleY + 1;
      var int1D = 0;

      try {
        //1,1 -> 0!
       int1D = this.state.rawData.data[Math.floor(realY-1)*this.state.rawData.width+ Math.floor(realX-1)];
      }
      catch (err) {
        console.log(err);

       }
      this.setState(prevState => ({posX: realX, posY: realY, intensity:int1D}));
  }

  canvasClick(options) {
    const posX = options.evt.layerX;
    const posY = options.evt.layerY;
    const time = options.evt.timeStamp;
    if (this.state.lastClick) {
      if (Math.abs(this.state.lastClick[0] - posX) < 2 &&
          Math.abs(this.state.lastClick[1] - posY) < 2 && //DoubleClick!
          (time - this.state.lastClick[2]) < 250 ){
            this.canvasDblClick(options);
            return;
          }
    }
    this.setState(prevState => ({
       lastClick: [posX,posY, time]
     }));
    switch(this.state.drawing) {
       case "polygon":
         const newPoint = {x: (posX-  this.state.x)/this.state.zoom*100,
                           y: (posY-  this.state.y)/this.state.zoom*100};

         this.setState(prevState => ({
            objectUnderCreation: [...prevState.objectUnderCreation, newPoint]
          }));
          //console.log(this.state.objectUnderCreation);

         break;
       default:
         break;
     }
  }

  canvasDblClick(options) {
    switch(this.state.drawing) {
       case "polygon":
         const newObject = this.state.objectUnderCreation;
         if (newObject.length > 3) {
           //the last point actually comes from this double-click,
           // we might consider removing it
           //newObject.pop();
           const polyPoints = [];
           for (let p of newObject) {
             polyPoints.push(p.x);
             polyPoints.push(p.y);
           }
           const polygon = {type: "Polygon", points: polyPoints}
           this.setState(prevState => ({
                drawing: "None",
                objectUnderCreation: [],
                MaskObjects: [...prevState.MaskObjects, polygon],
            }));
         }
         else {
           //Here, we might throw a notice
         };

         break;
       default:
         break;
     }
  }

  //Canvas object actions



  editPolygon(id) {
    //TODO: reimplement for KONVA
    console.log("Edit poly");
    const polygon = this.state.MaskObjects[id];

    const points = polygon.points;
      for (let pointnr in points) {
        let point = points[pointnr];
        console.log(point);
        let circle = new fabric.Circle({
          radius: Math.max(2/this.canvas.getZoom(), 0.5),
          fill: 'white',
          left: point.x,
          top: point.y,
          originX: 'center',
          originY: 'center',
          hasBorders: false,
          hasControls: false,

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
      //TODO: reimplement for Konva
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
     //TODO: reimplement for Konva
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
    const newZoom = parseInt(zoom);
    const currentZoom = this.state.zoom;
    //const canvas = this.canvas;

    //We want the center of the few to stay the sample
    var x =  -(newZoom/currentZoom - 1)*canvasWidth/2 + newZoom/currentZoom*this.state.x;
    var y =  -(newZoom/currentZoom - 1)*canvasHeight/2 + newZoom/currentZoom*this.state.y;
    // We need to know the current postions of the scroll bars for proper centering

    const currentBarHeight = this.state.scrollBarLength;
    const currentAvailableHeight = canvasHeight - padding * 2 - currentBarHeight;
    const newBarHeight = Math.floor(100*canvasHeight/newZoom);
    const newAvailableHeight = canvasHeight - padding * 2 - newBarHeight;
    var deltaY = 0;
    if (currentAvailableHeight === 0) {
      deltaY = 0.5;
    }
    else {
      deltaY  = (this.state.scrollY);
    }
    if (newAvailableHeight <= 0) {
      y = 0;
    }

    const currentBarWidth = this.state.scrollBarWidth;
    const currentAvailableWidth = canvasWidth - padding * 2 - currentBarWidth;
    const newBarWidth = Math.floor(100*canvasWidth/newZoom);
    const newAvailableWidth = canvasWidth - padding * 2 - newBarWidth;
    var deltaX = 0;
    if (currentAvailableWidth === 0) {
      deltaX = 0.5;
    }
    else {
      deltaX  = (this.state.scrollX - padding) / currentAvailableWidth;
    }
    if (newAvailableWidth <= 0) {
      x = 0;
    }

    const scrollY = Math.floor(deltaY*newAvailableHeight + padding);
    const scrollX = Math.floor(deltaX*newAvailableWidth + padding);
    this.setState(prevState => ({zoom: newZoom, scrollX: scrollX, scrollY: deltaY,
                                 scrollBarWidth: newBarWidth,
                                 scrollBarLength: newBarHeight,
                                 x: x, y: y}));
    //relative position of the beginning of the thumb, adjusted by half the thumbsize

  }



componentDidMount() {
   this.requestData();
}


  render() {
    let lines = [];
    if (this.state.objectUnderCreation.length > 1) {
      let point = this.state.objectUnderCreation[0];

      for (let p = 1; p <= this.state.objectUnderCreation.length-1; p++) {
        let newPoint = this.state.objectUnderCreation[p];
        lines.push([point.x, point.y, newPoint.x, newPoint.y]);
        point = newPoint;
      }
    }
    let polygons = [];
    for (let objectID in this.state.MaskObjects) {
      let object = this.state.MaskObjects[objectID];
      if (object.type === "Polygon") {
         polygons.push({points: object.points, id: objectID});
      }
    }

    let imageWidth
    let imageHeight
    if (this.state.image) {
       imageWidth = this.state.image.width;
       imageHeight = this.state.image.height;
    }
    else {
      imageWidth = canvasWidth;
      imageHeight = canvasHeight;
    }
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
                <option>1200</option>

              </select>
              </ul>
          </div>
          <Stage ref="canvas" className="canvascontainer"
                 width={canvasWidth} height={canvasHeight}
                 >
            <Layer scaleX={this.state.zoom/100}
                   scaleY={this.state.zoom/100}
                   y={this.state.y}
                   x={this.state.x}
                   >

                   <Kimage
                       image={this.state.image}
                        y={this.state.imageOffsetY}
                        x={this.state.imageOffsetX}

                       width={imageWidth}
                       onMouseMove={this.canvasMouseMove}
                       onClick={this.canvasClick}

                     />
              {lines.map(line =>
                 <Line points={line}
                       stroke={"white"}
                       strokeWidth={100/this.state.zoom}/>)}
               {polygons.map(line =>
                  <Line points={line.points}
                        closed={true}
                        fill={'rgba(255, 255, 255, 0.3)'}
                        onMouseMove={this.canvasMouseMove}/>)}

            </Layer>


              <VerticalScrollBar height={canvasHeight-10}
                                 objectHeight={Math.floor(imageHeight*this.state.zoom/100)}
                                 y={this.state.scrollY}
                                 onChange={this.verticalScroll}/>
              <Layer>
              <HorizontalScrollBar width={this.state.scrollBarWidth}
                                   x={this.state.scollX}
                                   onDragMove={this.horizontalScroll}/>
            </Layer>


          </Stage>
          <div className="intensityBox">x: {Math.floor(this.state.posX)}, y: {Math.floor(this.state.posY)}, intensity: {this.state.intensity}</div>
          <div className="maskPanel">
            <Button onClick={this.addPolygonStart}> Add Polygon</Button>
          </div>
        <canvas ref="inputcanvas" width={canvasWidth} height={canvasHeight}
                className="hidden"/>
      </div>
    );
  }
}

class HorizontalScrollBar extends Component {
  render() {
    return (
    <Rect width={this.props.width} height={10} fill={"blue"} opacity={0.3} x={this.props.x}
          y={canvasHeight-padding-10} draggable={true} dragBoundFunc={function (pos) {
              pos.x = Math.max(Math.min(pos.x, canvasWidth - this.width() - padding), padding);
              pos.y = canvasHeight - padding - 10;
              return pos;}}
              onDragMove={this.props.onDragMove}/>
    )
  }
}



const VerticalScrollBar = ({height,objectHeight,y, onChange}) =>
      <Layer>
      <Rect width={10} height={height} fill={"white"}
            opacity={0.9}
            x={canvasWidth-padding-10}
            y={padding} draggable={false} />
      {  height < objectHeight &&
        (<Rect width={10} height={height*height/objectHeight} fill={"blue"}
            opacity={0.3}
            x={canvasWidth-padding-10}
            y={y*(height - padding * 2 - height*height/objectHeight)+ padding}
            draggable={true}
            dragBoundFunc={function (pos) {
                pos.x = canvasWidth - padding - 10;
                pos.y = Math.max(Math.min(pos.y, canvasHeight - height*height/objectHeight - padding-10), padding);
                return pos;}}
            onDragMove={(e) => {
                const barHeight = height*height/objectHeight
                const availableHeight = height- padding * 2 - barHeight;
                if (availableHeight > 0) {
                  var delta = (e.target._lastPos.y - padding) / availableHeight;
                  onChange(delta);}
                }}/>)
            }
      </Layer>




export default App;
