```javascript
//Feature wise data extraction
//Noufa Cheerakkollil Konath; Consultant - CIMMYT

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
    r2019 = ee.FeatureCollection("users/cknoufa94/rice_2019"),
    r2020 = ee.FeatureCollection("users/cknoufa94/rice_2020"),
    era5_hourly = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY");
    
var FC = r2020
//filter image collection to desired year, Kelvin to Celcius
var era5_hourly = era5_hourly.filterBounds(geometry).filterDate('2020-05-01','2020-12-30').select('temperature_2m')
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
    .advance(1,unit).advance(-1,'month')
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

var dailyEra5Min = temporalAverage(era5_hourly,'day',ee.Reducer.min())
var dailyEra5Max = temporalAverage(era5_hourly,'day',ee.Reducer.max())
/*var pkg = require('users/kongdd/public:Math/pkg_trend.js');
var daily = ncep.map(pkg.add_dn(true, 1))
print ('daily',daily)
var dailyNCEP = pkg.aggregate_prop(daily, "dn", 'mean').map(function(img){
                      return img.set('date', img.date().format('YYYY-MM-dd'))
})*/

print (dailyEra5Min)

var filter = ee.Filter.equals({
  leftField: 'date',
  rightField: 'date'
});
var join = ee.Join.saveFirst({
    matchKey: 'match',
});


var era5Daily = ee.ImageCollection(join.apply(dailyEra5Min,dailyEra5Max,filter))
  .map(function(image) {
    return image.addBands(image.get('match'))
                 .set('date', image.date().format('YYYY_MM_dd'));
  });
print ('combined', era5Daily)


//Feature wise extraction of minimum 2m air temperature
var fExtract = FC.map(function(feature){
  //sort
  var iCol = era5Daily.sort('system:time_start')//.toList(era5.size())
  //get sowing date from point
  var startDoy = feature.get('sowing_day')
  //get harvest date from point
  var endDoY = feature.get('harvest_da')
  //filter collection, once for each of 1050 points
  iCol = iCol.filter(ee.Filter.dayOfYear(startDoy,endDoY))
  //Find pixelwise minimum for the season
  var gdd = iCol.map(function(image){
    var daily_gdd = image.expression('((Tmax+Tmin)/2)-Tbase',
    {
      Tmin:image.select('temperature_2m_min'),
      Tmax: image.select('temperature_2m_max'),
      Tbase: 10
    })
    return daily_gdd.rename('GDD')
  })
  var gddAccum = gdd.reduce(ee.Reducer.sum())//ee.ImageCollection.fromImages(iList).reduce(ee.Reducer.min())
  //Extact value at the point location
  var extracted = gddAccum.reduceRegion(ee.Reducer.mean(),feature.geometry(),1000,'EPSG:4326')
  //add that as a property of the feature
  return feature.set('gdd accum',extracted.get('GDD_sum'))
})//repeat for all points
fExtract = fExtract.select(['.*'],null,false);
print ('feature value extraction',fExtract)

var url = fExtract.getDownloadURL({format:'csv', filename:'GDD accumulated - 2020'})
print (url)
```
