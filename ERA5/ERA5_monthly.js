//Feature wise data extraction
//Extracts ERA5 monthly aggregate data to each point in the feature collection

//Noufa Cheerakkollil Konath; Consultant - CIMMYT
//var ncep = ncep.filterDate('2019-04-01','2019-12-31').filterBounds(geometry)
//print (ncep)
//filter image collection to desired year, Kelvin to Celcius

var era5 = ee.ImageCollection("ECMWF/ERA5/DAILY"),
    geometry = 
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[66.63353328385547, 37.24549118634652],
          [66.63353328385547, 7.3813550764372025],
          [97.74681453385547, 7.3813550764372025],
          [97.74681453385547, 37.24549118634652]]], null, false),
    modis = ee.ImageCollection("MODIS/006/MOD11A1"),
    gcom = ee.ImageCollection("JAXA/GCOM-C/L3/LAND/LST/V1"),
    ncep = ee.ImageCollection("NCEP_RE/surface_temp"),
    era5_hourly = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY"),
    w2020 = ee.FeatureCollection("users/cknoufa94/CIMMYT/wheat_2020_21_India"),
    w2019 = ee.FeatureCollection("users/cknoufa94/CIMMYT/wheat_2019_20_India");


Map.addLayer(geometry)

var firstDayOfYear = ee.Date('2020-01-10')
var firstDayOfNextYear = ee.Date('2021-01-10')
print (firstDayOfYear)
var startDate = ee.Date('2020-10-01')
var endDate = ee.Date('2021-05-01')
var FC = w2020
//CHANGE REDUCER HERE
var reducer = ee.Reducer.min()
var months = [10,11,12,1,2,3,4]
print(months)
Map.addLayer(FC)
Map.centerObject(FC,6)
var era5_hourly = era5_hourly.filterBounds(geometry).filterDate(startDate,endDate).select('temperature_2m')
                .map(function(image){
                  return image.subtract(273.15).copyProperties(image,['system:index','system:time_start','system:time_end'])//'day','month','year',
                })
              
            
//print (era5_hourly)
//Map.addLayer(ncep.first(),{},'modis')
var temporalAverage = function(collection, unit, reducer) {

  var startDate = ee.Date(ee.Image(collection.sort('system:time_start').first().get('system:time_start')));
  startDate = startDate.advance(ee.Number(0).subtract(startDate.getRelative('month',unit)),'month')
    .update(null,null,null,0,0,0);
  
  var endDate = ee.Date(ee.Image(collection.sort('system:time_start',false).first()).get('system:time_start'));
  endDate = endDate.advance(ee.Number(0).subtract(endDate.getRelative('month',unit)),'month')
    .advance(1,unit)//.advance(-1,'month')
    .update(null,null,null,23,59,59);

  var dateRanges = ee.List.sequence(0, endDate.difference(startDate,unit).round().subtract(1))
  function makeTimeslice(num) {
    var start = startDate.advance(num, unit);
    var startDateNum = ee.Number.parse(start.format("YYYYMMdd"));
    var end = start.advance(1, unit).advance(-1, 'second');
    // Filter to the date range
    var filtered = collection.filterDate(start, end);
    // Get the mean
    var unitMeans = filtered.reduce(reducer)
      .set('system:time_start',start.millis(),'system:time_end',end,'date',startDateNum);
    return unitMeans;
  }
  // Aggregate to each timeslice
  var new_collection = ee.ImageCollection(dateRanges.map(makeTimeslice));

  return new_collection;
};

var dailyEra5 = temporalAverage(era5_hourly,'day',reducer)
/*var pkg = require('users/kongdd/public:Math/pkg_trend.js');
var daily = ncep.map(pkg.add_dn(true, 1))
print ('daily',daily)
var dailyNCEP = pkg.aggregate_prop(daily, "dn", 'mean').map(function(img){
                      return img.set('date', img.date().format('YYYY-MM-dd'))
})*/

var monthlyReduced = ee.ImageCollection.fromImages(months.map(function(m) {
  var filtered = dailyEra5.filter(ee.Filter.calendarRange({
    start: m,
    field: 'month'
  }));
  var reduced = filtered.reduce(ee.Reducer.stdDev());
  //var min = filtered.reduce(ee.Reducer.min());
  //var max = filtered.reduce(ee.Reducer.max());
  return reduced.rename(ee.Date.fromYMD(1,m,1).format('MMMM'))//.addBands(min.rename('min').addBands(max.rename('max')))
      .set('month',ee.Date.fromYMD(1,m,1).format('MMMM'));
}));
print('monthly solar rad',monthlyReduced);
//Map.addLayer(monthlyReduced,{},'monthly reduced')
var reducerImage = monthlyReduced.toBands()
Map.addLayer(reducerImage,{},'monthly reducer')
print('monthly solar rad',reducerImage);

//print('month', ee.Date.fromYMD(1,4,1))

var SR_Reducer = reducerImage.reduceRegions({
  reducer : ee.Reducer.mean(),
  collection: FC,
  scale: 5000
}).select(['.*'],null,false);
print (SR_Reducer)

var URL = SR_Reducer.getDownloadURL({format: 'csv',
                                  filename: 'min temp - monthly sd- 2020-21'});
print (URL)
var chart = ui.Chart.image.series({
  imageCollection:dailyEra5, region:FC.limit(10), reducer:ee.Reducer.mean(), scale:5000})
print(chart)
var chart2 = ui.Chart.image.series({
  imageCollection:era5_hourly.filterDate('2021-03-30','2021-03-31'/*startDate.advance(1,'day')*/), region:FC.limit(10), reducer:ee.Reducer.mean(), scale:5000})
print(chart2)
print ('daily solar rad',dailyEra5)
Map.addLayer(dailyEra5,{},'ERA 5')




print (dailyEra5)
/*
//Add DoY property; not important
era5 = era5.map(function(image){
  var sysInd = image.get('system:index');
  var string = ee.String (sysInd);
  var a = string.slice(0,4);
  var b = string.slice(4,6);
  var c = string.slice(6,8);
  var d = '-';
  var dateString = a.cat(d).cat(b).cat(d).cat(c);
  var date = ee.Date(dateString);
  var doy = date.getRelative('day', 'year')
  return image.set('Date',date,'DoY', doy)
  .addBands(ee.Image.constant(doy).uint16().rename('DayOfYear'));
 
});
print ('with date',era5)
print('2019-rice',r2019)
*/

//Feature wise extraction of minimum 2m air temperature
var fExtract = FC.map(function(feature){
  //sort
  var iCol = dailyEra5.sort('system:time_start')//.toList(era5.size())
  //get sowing date from point
  var startDoy = firstDayOfYear.advance(feature.get('sowing_dat'),'day')
  //get harvest date from point
  var endDoy = firstDayOfNextYear.advance(feature.get('harvest_da'),'day')
  //filter collection, once for each of 1050 points
  iCol = iCol.filter(ee.Filter.date(startDoy,endDoy))
  //Find pixelwise minimum for the season
  iCol = iCol.reduce(ee.Reducer.stdDev()).rename('temp')//.subtract(273.15)//ee.ImageCollection.fromImages(iList).reduce(ee.Reducer.min())
  //Extact value at the point location
  var extracted = iCol.reduceRegion(ee.Reducer.mean(),feature.geometry(),5000,'EPSG:4326')
  //add that as a property of the feature
  return feature.set('temperature',extracted.get('temp'))
})//repeat for all points
fExtract = fExtract.select(['.*'],null,false);
print ('feature value extraction',fExtract)

var url = fExtract.getDownloadURL({format:'csv', filename:'min temp - sd - 2020-21'})
print (url)
```
