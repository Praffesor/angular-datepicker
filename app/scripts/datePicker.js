'use strict';
var Module = angular.module('datePicker', []);

Module.constant('datePickerConfig', {
  template : 'templates/datepicker.html',
  view : 'month',
  views : ['year', 'month', 'date', 'hours', 'minutes'],
  momentNames : {
    year : 'year',
    month : 'month',
    date : 'day',
    hours : 'hours',
    minutes : 'minutes'
  },
  viewConfig : {
    year : ['years', 'isSameYear'],
    month : ['months', 'isSameMonth'],
    hours : ['hours', 'isSameHour'],
    minutes : ['minutes', 'isSameMinutes']
  },
  step : 5
});

//Moment format filter.
Module.filter('mFormat', function () {
  return function (m, format, tz) {
    if (!(moment.isMoment(m))) {
      return moment(m).format(format);
    }
    return tz ? moment.tz(m, tz).format(format) : m.format(format);
  };
});

Module.directive('datePicker', ['datePickerConfig', 'datePickerUtils', function datePickerDirective(datePickerConfig, datePickerUtils) {

  //noinspection JSUnusedLocalSymbols
  return {
    // this is a bug ?
    require : '?ngModel',
    template : '<div ng-include="template"></div>',
    scope : {
      model : '=datePicker',
      after : '=?',
      before : '=?',
      customData : '='
    },
    link : function (scope, element, attrs, ngModel) {
      function prepareViews() {
        scope.views = datePickerConfig.views.concat();
        scope.view = attrs.view || datePickerConfig.view;

        scope.views = scope.views.slice(
          scope.views.indexOf(attrs.maxView || 'year'),
          scope.views.indexOf(attrs.minView || 'minutes') + 1
        );

        if (scope.views.length === 1 || scope.views.indexOf(scope.view) === -1) {
          scope.view = scope.views[0];
        }
      }

      function getDate(name) {
        return datePickerUtils.getDate(scope, attrs, name);
      }

      datePickerUtils.setParams(attrs.timezone);

      var arrowClick = false,
        tz = scope.tz = attrs.timezone,
        createMoment = datePickerUtils.createMoment,
        eventIsForPicker = datePickerUtils.eventIsForPicker,
        step = parseInt(attrs.step || datePickerConfig.step, 10),
        partial = !!attrs.partial,
        minDate = getDate('minDate'),
        maxDate = getDate('maxDate'),
        pickerID = element[0].id,
        now = scope.now = createMoment(),
        selected = scope.date = createMoment(scope.model || now),
        autoclose = attrs.autoClose === 'true';

      if (!scope.model) {
        selected.minute(Math.ceil(selected.minute() / step) * step).second(0);
      }

      scope.template = attrs.template || datePickerConfig.template;

      scope.watchDirectChanges = attrs.watchDirectChanges !== undefined;
      scope.callbackOnSetDate = attrs.dateChange ? datePickerUtils.findFunction(scope, attrs.dateChange) : undefined;

      prepareViews();

      scope.setView = function (nextView) {
        if (scope.views.indexOf(nextView) !== -1) {
          scope.view = nextView;
        }
      };

      scope.selectDate = function (date) {
        if (attrs.disabled) {
          return false;
        }
        if (isSame(scope.date, date)) {
          date = scope.date;
        }
        date = clipDate(date);
        if (!date) {
          return false;
        }
        scope.date = date;

        var nextView = scope.views[scope.views.indexOf(scope.view) + 1];
        if ((!nextView || partial) || scope.model) {
          setDate(date);
        }

        if (nextView) {
          scope.setView(nextView);
        } else if (autoclose) {
          element.addClass('hidden');
          scope.$emit('hidePicker');
        } else {
          prepareViewData();
        }
      };

      function setDate(date, isArrowClick) {
        if (date) {
          scope.model = date;
          if (ngModel) {
            ngModel.$setViewValue(date);
          }
        }
        scope.$emit('setDate', scope.model, scope.view, isArrowClick || false);

        //This is duplicated in the new functionality.
        if (scope.callbackOnSetDate) {
          scope.callbackOnSetDate(attrs.datePicker, scope.date);
        }
      }

      function update() {
        var view = scope.view;
        datePickerUtils.setParams(tz);

        if (scope.model && !arrowClick) {
          scope.date = createMoment(scope.model);
          arrowClick = false;
        }

        var date = scope.date;

        switch (view) {
          case 'year':
            scope.years = datePickerUtils.getVisibleYears(date);
            break;
          case 'month':
            scope.months = datePickerUtils.getVisibleMonths(date);
            break;
          case 'date':
            scope.weekdays = scope.weekdays || datePickerUtils.getDaysOfWeek();
            scope.weeks = datePickerUtils.getVisibleWeeks(date);
            break;
          case 'hours':
            scope.hours = datePickerUtils.getVisibleHours(date);
            break;
          case 'minutes':
            scope.minutes = datePickerUtils.getVisibleMinutes(date, step);
            break;
        }

        prepareViewData();
      }

      function watch() {
        if (scope.view !== 'date') {
          return scope.view;
        }
        return scope.date ? scope.date.month() : null;
      }

      scope.$watch(watch, update);

      if (scope.watchDirectChanges) {
        scope.$watch('model', function () {
          arrowClick = false;
          update();
        });
      }

      function prepareViewData() {
        var view = scope.view,
          date = scope.date,
          classes = [], classList = '',
          i, j;

        datePickerUtils.setParams(tz);

        if (view === 'date') {
          var weeks = scope.weeks, week;
          scope.isRangeStart = attrs.ngModel == 'start';
          scope.isRangeEnd = attrs.ngModel == 'end';
          var isRange = scope.isRangeStart || scope.isRangeEnd;
          var setSelected = scope.isRangeEnd;
          if (isRange && weeks.length < 6) {
            var lastMonday = moment(weeks[weeks.length - 1][0]);
            lastMonday.add(7, 'd');
            weeks.push(datePickerUtils.getDaysOfWeek(lastMonday));
          }
          for (i = 0; i < weeks.length; i++) {
            week = weeks[i];
            classes.push([]);

            for (j = 0; j < week.length; j++) {
              var isFirst = false, isLast = false;
              classList = '';

              if (datePickerUtils.isSameDay(date, week[j])) {
                classList += ' is-selected';
                if (scope.isRangeStart) {
                  setSelected = true;
                  isFirst = true;
                } else if (scope.isRangeEnd) {
                  setSelected = false;
                  isLast = true;
                }
              }

              if (week[j].month() !== date.month() || !inValidRange(week[j])) {
                classList += ' is-disabled';
              } else if (isRange && setSelected) {
                classList += ' is-selected';
                if (j > 0 && !inValidRange(week[j - 1])) {
                  isFirst = true;
                }
                if (j < week.length - 1 && !inValidRange(week[j + 1])) {
                  isLast = true;
                }
              }

              if (minDate && datePickerUtils.isSameDay(date, minDate)) {
                isFirst = true;
              }
              if (maxDate && datePickerUtils.isSameDay(date, maxDate)) {
                isLast = true;
              }

              if (isRange && isFirst ^ isLast) {
                if (isFirst) {
                  classList += ' is-selected-first';
                }
                if (isLast) {
                  classList += ' is-selected-last';
                }
              }

              if (scope.customData && scope.customData.isRangeStart) {
                classList += ' is-selected-first';
              }

              classes[i].push(classList);
            }
          }
        } else {
          var params = datePickerConfig.viewConfig[view],
            dates = scope[params[0]],
            compareFunc = params[1];

          for (i = 0; i < dates.length; i++) {
            classList = '';
            if (datePickerUtils[compareFunc](date, dates[i])) {
              classList += ' is-selected';
            }
            if (isNow(dates[i], view)) {
              classList += ' is-now';
            }
            if (!inValidRange(dates[i])) {
              classList += ' is-disabled';
            }
            classes.push(classList);
          }
        }
        scope.classes = classes;
      }

      scope.next = function (delta) {
        var date = moment(scope.date);
        delta = delta || 1;
        switch (scope.view) {
          case 'year':
          /*falls through*/
          case 'month':
            date.year(date.year() + delta);
            break;
          case 'date':
            date.month(date.month() + delta);
            break;
          case 'hours':
          /*falls through*/
          case 'minutes':
            date.hours(date.hours() + delta);
            break;
        }
        date = clipDate(date);
        if (date) {
          scope.date = date;
          setDate(date, true);
          arrowClick = true;
          update();
        }
      };

      function inValidRange(date) {
        var valid = true;
        if (minDate && minDate.isAfter(date)) {
          valid = isSame(minDate, date);
        }
        if (maxDate && maxDate.isBefore(date)) {
          valid &= isSame(maxDate, date);
        }
        return valid;
      }

      function isSame(date1, date2) {
        return date1.isSame(date2, datePickerConfig.momentNames[scope.view]) ? true : false;
      }

      function clipDate(date) {
        if (minDate && minDate.isAfter(date)) {
          scope.$emit('dateClip', date);
          return minDate;
        } else if (maxDate && maxDate.isBefore(date)) {
          scope.$emit('dateClip', date);
          return maxDate;
        } else {
          return date;
        }
      }

      function isNow(date, view) {
        var is = true;

        switch (view) {
          case 'minutes':
            is &= ~~(now.minutes() / step) === ~~(date.minutes() / step);
          /* falls through */
          case 'hours':
            is &= now.hours() === date.hours();
          /* falls through */
          case 'date':
            is &= now.date() === date.date();
          /* falls through */
          case 'month':
            is &= now.month() === date.month();
          /* falls through */
          case 'year':
            is &= now.year() === date.year();
        }
        return is;
      }

      scope.prev = function (delta) {
        return scope.next(-delta || -1);
      };

      if (pickerID) {
        scope.$on('pickerUpdate', function (event, pickerIDs, data) {
          if (eventIsForPicker(pickerIDs, pickerID)) {
            var updateViews = false, updateViewData = false;

            if (angular.isDefined(data.minDate)) {
              minDate = data.minDate ? data.minDate : false;
              updateViewData = true;
            }
            if (angular.isDefined(data.maxDate)) {
              maxDate = data.maxDate ? data.maxDate : false;
              updateViewData = true;
            }

            if (angular.isDefined(data.minView)) {
              attrs.minView = data.minView;
              updateViews = true;
            }
            if (angular.isDefined(data.maxView)) {
              attrs.maxView = data.maxView;
              updateViews = true;
            }
            attrs.view = data.view || attrs.view;

            if (updateViews) {
              prepareViews();
            }

            if (updateViewData) {
              update();
            }
          }
        });
      }
    }
  };
}]);
