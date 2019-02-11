import React, { Component } from 'react';
import PropTypes from 'prop-types';
//import classNames from 'classnames';
import {Button} from 'react-bootstrap';
import { Stage, Layer, Rect, Line, Group, Circle} from 'react-konva';
import { Image as Kimage } from 'react-konva';

import './App.css';

import io from 'socket.io-client';
const socket = io.connect("http://0.0.0.0:8081");




const padding = 0;
const scrollBarWidth = 10;
const canvasHeight = 330;
const canvasWidth = 560;
const minCounts = -2;
const maxCounts = 2000;

const beamGeometry = {
  detectorDistance: 2.87,
  wavelength: 0.99e-10,
  pixelSize: 172e-6,
  beamX: 884,
  beamY: 92,
  detectorX: 981,
  detectorY: 1043
}

const resUnits = "nm-1"; //Alternatives Ang, nm, Ang-1

//a function that takes the geometry and calculates suitable resolution rings in detectorPixels
const resolutionRadii = (unit,beamGeometry) => {
  const rings = []
  const maxDistInPix = Math.sqrt(Math.max((beamGeometry.detectorX-beamGeometry.beamX)**2 + (beamGeometry.detectorY-beamGeometry.beamY)**2,
                          beamGeometry.beamX**2 + (beamGeometry.detectorY-beamGeometry.beamY)**2,
                          (beamGeometry.detectorX-beamGeometry.beamX)**2 + beamGeometry.beamY**2,
                          beamGeometry.beamX**2 + beamGeometry.beamY**2));

  const minDistInPix = 10;
  const thetaMin = 0.5*Math.atan(beamGeometry.pixelSize*minDistInPix/beamGeometry.detectorDistance)
  const thetaMax = 0.5*Math.atan(beamGeometry.pixelSize*maxDistInPix/beamGeometry.detectorDistance)
  switch(unit) {
     case "nm-1": //SAXS start at beamCenter, work outward, step 0.1 nm-1
      const dq = q => {
        if (q < 0.1) return 0.01;
        else if (q < 1)  return 0.1;
        else return 0.5;
      }
      const qmin = 4*3.14/beamGeometry.wavelength*Math.sin(thetaMin)*1e-9;
      const qmax = 4*3.14/beamGeometry.wavelength*Math.sin(thetaMax)*1e-9;

      const start = Math.ceil(qmin*1e2)*1e-2
      for (let q =start; q<qmax; q+= dq(q)){

        q = q.toFixed(3)*1.0 //floating point fix
        const theta = Math.asin(q*1e9*beamGeometry.wavelength/(4*3.14))
        const pix = Math.tan(theta*2)*beamGeometry.detectorDistance/beamGeometry.pixelSize
        rings.push({q: q, radius: Math.round(pix)});
      }
      //console.log(rings)
      break;
     case "Ang":
      break;
    }
    return rings;
  }

const resRings = resolutionRadii(resUnits, beamGeometry)


class App extends Component {

  constructor(props){
     super(props)
     this.mainLayer = React.createRef();
     //this.kImage = React.createRef();
     this.state = {imageScaleX: 1,
                   imageScaleY: 1,
                   imageOffsetX: 0,
                   imageOffsetY: 0,
                   drawing: "None",
                   objectUnderCreation: [],
                   MaskObjects: [],
                   zoom: 100,
                   showRings: false,
                   logInt: false,
                   rawData: {},
                   posX: 0,
                   posY: 0,
                   intensity: 0,
                   image: null,
                   scrollX: 0,
                   scrollY: 0,
                   y: 0,
                   x: 0,
                   scrollBarLength: canvasHeight,
                   scrollBarWidth: canvasWidth,
                   imageWidth:  canvasWidth,
                   imageHeight:  canvasHeight,
                   lastClick: null,
                   maxInt: 1000,
                   minInt: 0,
                  };

     this.createImg = this.createImg.bind(this);

     //.transformData = this.transformData.bind(this);

     this.zoomSelect = this.zoomSelect.bind(this);
     this.addPolygonStart = this.addPolygonStart.bind(this);
     this.canvasMouseMove = this.canvasMouseMove.bind(this);
     this.canvasClick = this.canvasClick.bind(this);
     this.canvasDblClick = this.canvasDblClick.bind(this);
     this.requestData = this.requestData.bind(this);
     this.editPolygon = this.editPolygon.bind(this);
     this.moveImage = this.moveImage.bind(this);
     this.imageDragBox = this.imageDragBox.bind(this);
     this.verticalScroll = this.verticalScroll.bind(this);
     this.horizontalScroll = this.horizontalScroll.bind(this);
     this.minIntChanged = this.minIntChanged.bind(this);
     this.maxIntChanged = this.maxIntChanged.bind(this);
     this.ringShowChanged = this.ringShowChanged.bind(this);
  }

 minIntChanged(event) {
   const newMin = Math.max(0,Math.min(event.target.value, this.state.maxInt-1));
   this.setState(prevState => ({minInt: newMin}));
   if (this.state.rawData && this.state.rawData.data) {
     const time = event.timeStamp;
     if (this.state.lastImage) {
       if (time - this.state.lastImage < 100 ){
             //We just updated, let's wait
             return;
           }

     }
    this.setState(prevState => ({lastImage: time}));
     if (this.state.image) {

     const newImg = new Image();
     newImg.onload = event =>   this.createImg(newImg);
     newImg.src = "http://localhost:8081/imagergb/"+ String(newMin) +"/" + String(this.state.maxInt) +"/"+ new Date().getTime()+".png"

     }
   }
 }

 maxIntChanged(event) {
   const newMax = Math.max(event.target.value, this.state.minInt+1);
   this.setState(prevState => ({maxInt: newMax}));
   if (this.state.rawData && this.state.rawData.data) {
     if (this.state.image) {
     if (this.state.imageBeingLoaded) {
       var newImg = this.state.imageBeingLoaded;
     }
     else {
       var newImg = new Image();
     }
     newImg.onload = () =>  {
       this.createImg(newImg);
       this.setState(prevState => ({
          imageBeingLoaded: null,
        }));
     }
     newImg.src = "http://localhost:8081/imagergb/"+ String(this.state.minInt) +"/" + String(newMax) +"/"+ new Date().getTime()+".png"
     this.setState(prevState => ({
        imageBeingLoaded: newImg,
      }));
     }
   }
 }

 ringShowChanged(event) {
   const ringShow = event.target.checked;
   this.setState(prevState => ({
      showRings: ringShow,
    }));
 }

  //Data relatefunctions
  requestData() {
    socket.on('data2d', (data2d) => {
      this.setState(prevState => ({
         rawData: {data: data2d.data, width: data2d.width, height: data2d.height},
         imageWidth: data2d.width,
         imageHeight: data2d.height,
       }));
    });
    socket.emit('data2d');
    const newImg = new Image();
    newImg.onload = event =>   this.createImg(newImg);
    newImg.src = "http://localhost:8081/imagergb/"+ String(this.state.minInt) +"/" + String(this.state.maxInt) +"/" +new Date().getTime() +".png"
  //  this.createImg(newImg);
  }



  createImg(img)  {
   const originalWidth = img.width
   const originalHeight = img.height
   const scalingFactorW = (canvasWidth-scrollBarWidth)/img.width
   const scalingFactorH = (canvasHeight-scrollBarWidth)/img.height
   const scalingFactor = Math.min(scalingFactorW,scalingFactorH)
   const offsetX = Math.floor(canvasWidth - img.width*scalingFactor)/2 - scrollBarWidth;
   const offsetY = Math.max(0,((canvasHeight - img.height*scalingFactor)/2 - scrollBarWidth));
   img.width = img.width*scalingFactor;
   img.height = img.height*scalingFactor;
   const beamX = beamGeometry.beamX*img.width/originalWidth + offsetX
   const beamY = beamGeometry.beamY*img.height/originalHeight + offsetY
   const resolutionRings = resRings.map(ring => ({q: ring.q, radius: ring.radius*scalingFactor}))

    this.setState(prevState => ({
      image: img,
      imgSource: img.src,
      imageScaleX: img.width/originalWidth, //img.width is always int!
      imageScaleY: img.height/originalHeight, //img.width is always int!
      imageOffsetX: offsetX,
      imageOffsetY: offsetY,
      beamCenter: {x: beamX, y: beamY},
      ResolultionCircles: resolutionRings,
     }));
  }



  //Canvas actions

  verticalScroll(delta) {
      //currenlty naively assumes image exists!
      const y = -delta * (this.state.image.height*this.state.zoom/100 - canvasHeight)- this.state.imageOffsetY*this.state.zoom/100;
      this.setState(prevState => ({scrollY: delta, y: y}))

  }

  horizontalScroll(delta) {
      const x =  - delta * (this.state.image.width*this.state.zoom/100-canvasWidth) - this.state.imageOffsetX*this.state.zoom/100;
      this.setState(prevState => ({scrollX: delta, x: x}))
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
             polyPoints.push(p);
             //polyPoints.push(p.y);
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

  editPolygon(points,id) {
    const maskObjects = this.state.MaskObjects;
    //const polygon = maskObjects[id];
    maskObjects[id].points = points;
    this.setState(prevState => ({Maskobjects: maskObjects}));
  }



 //Canvas state functions
   addPolygonStart() {
       this.setState(prevState => ({drawing: "polygon"}));
   }



  zoomSelect(event, zoom) {
    //in the functions call from the zoom selector, zoom is e.target.value and
    //as o7 07/01/2019 a string!
    // if (!this.state.image) {
    //   this.setState(prevState => ({zoom: 100}));
    //   return;
    // }
    const newZoom = parseInt(zoom);
    const currentZoom = this.state.zoom;

    //We want the center of the view to stay the same
    var x =  -(newZoom/currentZoom - 1)*canvasWidth/2 + newZoom/currentZoom*this.state.x;
    var y =  -(newZoom/currentZoom - 1)*canvasHeight/2 + newZoom/currentZoom*this.state.y;

    var deltaY = 0;
    if (canvasHeight > this.state.image.height*currentZoom/100 &&
        canvasHeight < this.state.image.height*newZoom/100) {
      deltaY = 0.5;
    }
    else if (canvasHeight > this.state.image.height*newZoom/100) {
      y = 0;
      deltaY = 0;
    }
    else {
      deltaY  = (this.state.scrollY);
    }

    var deltaX = 0;
    if (canvasWidth > this.state.image.width*currentZoom/100 &&
        canvasWidth < this.state.image.width*newZoom/100) {
      deltaX = 0.5;
    }
    else if (canvasWidth > this.state.image.width*newZoom/100) {
      x = 0;
      deltaX = 0;
    }
    else {
      deltaX  = (this.state.scrollX);
    }

    this.setState(prevState => ({zoom: newZoom, scrollX: deltaX, scrollY: deltaY,
                                 x: x, y: y}));


  }

imageDragBox (pos) {
  //we only allow dragging if the object is larger than the canvas
  const imageWidth = this.state.image.width;
  const imageHeight = this.state.image.height;
  if (this.state.zoom*imageWidth/100 > canvasWidth) {
      pos.x = Math.floor(Math.max(Math.min(pos.x, -this.state.zoom*this.state.imageOffsetX/100), -this.state.zoom*(imageWidth+this.state.imageOffsetX)/100 + canvasWidth));
  }
  else {
    pos.x = 0;
  }
  if (this.state.zoom*imageHeight/100 > canvasHeight) {
    pos.y = Math.max(Math.min(pos.y, -this.state.zoom*this.state.imageOffsetY/100), -this.state.zoom*(imageHeight+this.state.imageOffsetY)/100 + canvasHeight);
  }
  else {
    pos.x = 0;
  }
  return pos;
}

moveImage(event) {
  //dragging the image actually should move the canvas...
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
  const newScrollX = (event.target._lastPos.x + this.state.zoom*this.state.imageOffsetX/100)/(-this.state.zoom*imageWidth/100 + canvasWidth);
  const newScrollY = (event.target._lastPos.y +  this.state.zoom*this.state.imageOffsetY/100)/(-this.state.zoom*imageHeight/100 + canvasHeight);
  this.setState(prevState => ({scrollX: newScrollX, scrollY: newScrollY,
                               x: event.target._lastPos.x, y: event.target._lastPos.y}));
}

componentDidMount() {
  // turn of smoothing

  const nativeCtx = this.mainLayer.current.getContext()._context;
  nativeCtx.webkitImageSmoothingEnabled = false;
  nativeCtx.mozImageSmoothingEnabled = false;
  nativeCtx.imageSmoothingEnabled = false;

   this.requestData();
}



// updateImage() {
//     const image = new window.Image();
//     image.src = this.props.image;
//     image.onload = () => this.createImg(image);
//   }

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
    let src
    if (this.state.image) {
       imageWidth = this.state.image.width;
       imageHeight = this.state.image.height;
       src = this.state.image.src
    }
    else {
      imageWidth = canvasWidth;
      imageHeight = canvasHeight;
      src = ''
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
                <option>6000</option>

              </select>
              <span>
                <input type="checkbox" checked={this.state.showRings} onChange={this.ringShowChanged}/>
                <label form="resRings">Resolution Rings</label>
                {this.state.showRings}
              </span>
              <div className="doubleRange">
                Min: {this.state.minInt} Max: {this.state.maxInt}
                <input className="minSlider" type="range" min={minCounts} max={maxCounts} step="1" value={this.state.minInt}
                      onInput={this.minIntChanged}/>
                <input className="maxSlider" type="range" min={minCounts} max={maxCounts} step="1" value={this.state.maxInt}
                       onInput={this.maxIntChanged}/>
              </div>
              </ul>

          </div>
          <Stage ref="canvas" className="canvascontainer"
                 width={canvasWidth} height={canvasHeight}
                 >
            <Layer ref={this.mainLayer}
                   scaleX={this.state.zoom/100}
                   scaleY={this.state.zoom/100}
                   y={this.state.y}
                   x={this.state.x}
                   draggable={true}
                   dragBoundFunc={this.imageDragBox}
                   onDragMove={this.moveImage}
                   >

               <Kimage
                    ref={this.kImage}
                    //className="diffImage"
                    image={this.state.image}
                    key={src}
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
                  <Polygon points={line.points}
                           pointSize={200/this.state.zoom}
                           onMouseMove={this.canvasMouseMove}
                           onChange={points => this.editPolygon(points,line.id)}/>)}
                {this.state.ResolultionCircles && this.state.showRings &&
                  <ResolultionCircles center={this.state.beamCenter}
                                      radii={this.state.ResolultionCircles}
                                      clipX = {this.state.imageOffsetX}
                                      clipY = {this.state.imageOffsetY}
                                      clipWidth = {this.state.image.width*this.state.zoom/100}
                                      clipHeight = {this.state.image.width*this.state.zoom/100}
                                      onMouseMove={this.canvasMouseMove}
                                      onClick={this.canvasClick}/>}
              </Layer>


              <VerticalScrollBar height={canvasHeight-2*padding-scrollBarWidth}
                                 objectHeight={Math.floor(imageHeight*this.state.zoom/100)}
                                 scrollY={this.state.scrollY}
                                 x={canvasWidth-padding-scrollBarWidth}
                                 y={padding}
                                 barWidth={scrollBarWidth}
                                 onChange={this.verticalScroll}/>

              <HorizontalScrollBar width={canvasWidth-2*padding-scrollBarWidth}
                                   objectWidth={Math.floor(imageWidth*this.state.zoom/100)}
                                   scrollX={this.state.scrollX}
                                   x={padding}
                                   y={canvasHeight-padding-scrollBarWidth}
                                   barHeight={scrollBarWidth}
                                   onChange={this.horizontalScroll}/>


          </Stage>
          <div className="intensityBox">x: {Math.floor(this.state.posX)}, y: {Math.floor(this.state.posY)}, intensity: {this.state.intensity}</div>
          <div className="maskPanel">
            <Button onClick={this.addPolygonStart}> Add Polygon</Button>
          </div>
        <canvas ref="inputcanvas" width={canvasWidth} height={canvasHeight}
                className="hidden" />
      </div>
    );
  }
}

const ResolultionCircles = ({center,radii, clipX, clipY, clipWidth, clipHeight, onMouseMove,onClick}) =>
  <Group clipX={clipX} clipY={clipY} clipWidth={clipWidth} clipHeight={clipHeight}>
    {radii.map((q) =>
      <Circle x={center.x} y = {center.y} radius={q.radius} stroke={"white"}
            strokeWidth = {0.1}
            draggable={false}
            onMouseMove={onMouseMove}
            onClick={onClick}
            />)}
  </Group>

const Polygon = ({points,pointSize, onMouseMove, onChange}) =>
     <Group>
     <Line points={points.flatMap(point => [point.x,point.y])}
           closed={true}
           fill={'rgba(255, 255, 255, 0.3)'}
           onMouseMove={onMouseMove}/>
     {points.map((point,index) =>
      <Circle x={point.x} y = {point.y} radius={pointSize*2} fill={"white"}
              opacity={0}
              draggable={true}
              dragBoundFunc={function (pos) {
                  pos.x = point.x;
                  pos.y = point.y;
                  return pos;}}
              onDragMove={(e) => {
                e.cancelBubble = true;
              }}/>)}
      {points.map((point,index) =>
       <Circle x={point.x} y = {point.y} radius={pointSize} fill={"white"}
               draggable={true}
               onDragMove={(e) => {
                 e.cancelBubble = true
                 const newPoints = points;
                 const newX = (e.target.attrs.x);
                 const newY = (e.target.attrs.y);
                 newPoints[index] = {x: newX, y: newY}
                 onChange(newPoints);}}/>)}
      </Group>



const HorizontalScrollBar = ({width,objectWidth, x,y, scrollX, barHeight, onChange}) =>
      <Layer x={0} y={0}>
      <Rect width={width} height={barHeight} fill={"white"}
            opacity={0.9}
            x={x}
            y={y} draggable={false} />
      {  width < objectWidth &&
        (<Rect width={width*width/objectWidth} height={barHeight} fill={"blue"}
            opacity={0.3}
            x={scrollX*(width - width*width/objectWidth)+ x}
            y={y}
            draggable={true}
            dragBoundFunc={function (pos) {
                pos.x = Math.max(Math.min(pos.x, width - width*width/objectWidth), x);
                pos.y = y; return pos;}}
            onDragMove={(e) => {
                const barWidth = width*width/objectWidth
                const availableWidth= width - barWidth;
                if (availableWidth > 0) {
                  var delta = (e.target._lastPos.x) / availableWidth;
                  onChange(delta);}
                }}/>)
            }
      </Layer>


HorizontalScrollBar.defaultProps = {
        barWidth: 10,
        scrollX: 0.5,
      };

HorizontalScrollBar.propTypes = {
        width: PropTypes.number.isRequired,
        objectWidth: PropTypes.number.isRequired,
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired,
        scrollX: PropTypes.number,
        barWidth:  PropTypes.number,
        onChange: PropTypes.func.isRequired,
      };


const VerticalScrollBar = ({height,objectHeight, x,y,scrollY, barWidth, onChange}) =>
      <Layer x={0} y={0}>
      <Rect width={barWidth} height={height} fill={"white"}
            opacity={0.9}
            x={x}
            y={y} draggable={false} />
      {  height < objectHeight &&
        (<Rect width={barWidth} height={height*height/objectHeight} fill={"blue"}
            opacity={0.3}
            x={x}
            y={scrollY*(height - height*height/objectHeight)+y}
            draggable={true}
            dragBoundFunc={function (pos) {
                pos.x = x;
                pos.y = Math.max(Math.min(pos.y, height - height*height/objectHeight), y);
                return pos;}}
            onDragMove={(e) => {
                const barHeight = height*height/objectHeight
                const availableHeight = height - barHeight;
                if (availableHeight > 0) {
                  var delta = (e.target._lastPos.y) / availableHeight;
                  onChange(delta);}
                }}/>)
            }
      </Layer>

      VerticalScrollBar.defaultProps = {
        barWidth: 10,
        scrollY: 0.5,
      };

      VerticalScrollBar.propTypes = {
        height: PropTypes.number.isRequired,
        objectHeight: PropTypes.number.isRequired,
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired,
        scrollY: PropTypes.number,
        barWidth:  PropTypes.number,
        onChange: PropTypes.func.isRequired,
      };


export default App;
