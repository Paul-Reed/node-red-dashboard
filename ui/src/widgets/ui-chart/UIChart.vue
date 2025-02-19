<template>
    <canvas ref="chart" :class="className" />
</template>

<script>
import { Chart } from 'chart.js/auto' // eslint-disable-line n/file-extension-in-import
import 'chartjs-adapter-luxon'

import { useDataTracker } from '../data-tracker.mjs' // eslint-disable-line import/order

import { shallowRef } from 'vue'
import { mapState } from 'vuex'

export default {
    name: 'DBUIChart',
    inject: ['$socket'],
    props: {
        id: { type: String, required: true },
        props: { type: Object, default: () => ({}) }
    },
    data () {
        return {
            chart: null
        }
    },
    computed: {
        ...mapState('data', ['messages'])
    },
    watch: {
        'props.label': function (value) {
            this.chart.options.plugins.title.text = value
            this.chart.update()
        },
        'props.chartType': function (value) {
            this.chart.config.type = value
            this.chart.update()
        },
        'props.xAxisType': function (value) {
            this.chart.options.scales.x.type = value
            this.chart.update()
        }
    },
    created () {
        // can't do this in setup as we have custom onInput function
        useDataTracker(this.id, this.onMsgInput, this.onLoad)
    },
    mounted () {
        // get a reference to the canvas element
        const el = this.$refs.chart

        // generate parsing options (https://www.chartjs.org/docs/latest/general/data-structures.html#object-using-custom-properties)
        // based on chart type and options provided from Node-RED
        const parsing = {}
        if (this.props.chartType === 'line' || this.props.chartType === 'scatter') {
            if (this.props.xAxisProperty) {
                parsing.xAxisKey = this.props.xAxisProperty
            }
        } else if (this.props.categoryType !== 'json' && this.props.chartType === 'bar') {
            if (this.props.category && this.props.categoryType !== 'msg') {
                parsing.xAxisKey = this.props.category
            } else {
                parsing.xAxisKey = 'category'
            }
        }

        if (this.props.categoryType !== 'json' && this.props.yAxisProperty) {
            parsing.yAxisKey = this.props.yAxisProperty
        }

        // y-axis limits
        const yOptions = {}
        if (Object.hasOwn(this.props, 'ymin') && this.props.ymin !== '') {
            yOptions.min = parseFloat(this.props.ymin)
        }
        if (Object.hasOwn(this.props, 'ymax') && this.props.ymax !== '') {
            yOptions.max = parseFloat(this.props.ymax)
        }

        // create our ChartJS object
        const chart = new Chart(el, {
            type: this.props.chartType,
            data: {
                labels: [],
                datasets: []
            },
            options: {
                animation: false,
                maintainAspectRatio: false,
                borderJoinStyle: 'round',
                scales: {
                    x: {
                        type: this.props.xAxisType || 'linear',
                        time: {
                            displayFormats: {
                                millisecond: 'HH:mm:ss'
                            }
                        }
                    },
                    y: yOptions
                },
                plugins: {
                    title: {
                        display: true,
                        text: this.props.label
                    },
                    legend: {
                        display: this.props.showLegend
                    }
                },
                parsing
            }
        })

        // don't want chart to be reactive, so we can use shallowRef
        this.chart = shallowRef(chart)
    },
    methods: {
        // given an object, return the value of the category property (which can be nested)
        getLabel (value, category) {
            if (this.props.categoryType !== 'property') {
                return category
            }
            // get nested property value
            if (category) {
                const props = category.split('.')
                props.forEach((prop) => {
                    if (value) {
                        value = value[prop]
                    }
                })
            }
            return value
        },
        onLoad (history) {
            if (history) {
                // we have received a history of data points
                // we need to add them to the chart
                // clear the chart first, onload is considered to provide all data into a chart
                this.clear()
                // adding is then just the same process as receiving a new msg
                this.onMsgInput(history)
            }
        },
        onMsgInput (msg) {
            if (Array.isArray(msg.payload) && !msg.payload.length) {
                // clear the chart if msg.payload = [] is received
                this.clear()
            } else {
                if (msg.action === 'replace' || (this.props.action === 'replace' && msg.action !== 'append')) {
                    // clear the chart
                    this.clear()
                }
                // update the chart
                this.add(msg)
            }
        },
        clear () {
            this.chart.data.labels = []
            this.chart.data.datasets = []
            this.chart.update()
        },
        add (msg) {
            const payload = msg.payload
            // determine what type of msg we have
            if (Array.isArray(msg) && msg.length > 0) {
                // we have received an array of messages (loading from stored history)
                msg.forEach((m, i) => {
                    const p = m.payload
                    const d = m._datapoint // server-side we compute a chart friendly format
                    const label = d.category
                    this.addPoints(p, d, label)
                })
            } else if (Array.isArray(payload) && msg.payload.length > 0) {
                // we have received a message with an array of data points
                // and should append each of them
                payload.forEach((p, i) => {
                    const d = msg._datapoint ? msg._datapoint[i] : null // server-side we compute a chart friendly format where required
                    const label = d.category
                    this.addPoints(p, d, label)
                })
            } else if (payload !== null && payload !== undefined) {
                // we have a single payload value and should append it to the chart
                const d = msg._datapoint // server-side we compute a chart friendly format
                const label = d.category
                this.addPoints(msg.payload, d, label)
            } else {
                // no payload
                console.log('have no payload')
            }
            if (this.props.chartType === 'line' || this.props.chartType === 'scatter') {
                this.limitDataSize()
            }
            this.chart.update()
        },
        addPoints (payload, datapoint, label) {
            const d = {
                ...datapoint,
                ...payload
            }
            if (Array.isArray(label) && label.length > 0) {
                // we have an array of series, meaning we plot multiple data points per data object
                for (let i = 0; i < label.length; i++) {
                    const dd = {
                        ...d
                    }
                    dd.category = d.category[i]
                    dd.y = d.y[i]
                    this.addPoint(payload, dd, label[i])
                }
            } else {
                this.addPoint(payload, datapoint, label)
            }
        },
        addPoint (payload, datapoint, label) {
            const d = {
                ...datapoint,
                ...payload
            }
            if (this.props.chartType === 'line' || this.props.chartType === 'scatter') {
                this.addToLine(d, label)
            } else if (this.props.chartType === 'bar') {
                this.addToBar(d, label)
            }

            // TODO: Handle storage of restricted data size, need to manage in store, so pass props through?

            // APPEND our latest data point to the store
            this.$store.commit('data/append', {
                widgetId: this.id,
                msg: {
                    payload,
                    _datapoint: datapoint,
                    series: label
                }
            })
        },
        /**
         * Function to handle adding a datapoint (generated NR-side) to Line Charts
         * @param {*} datapoint
         */
        addToLine (datapoint, label) {
            // consider msg.topic (label) as the label for the series
            const datalabels = [...new Set(this.chart.data.datasets?.map((set) => {
                return set.label
            }))]
            const index = datalabels?.indexOf(label)
            // the chart is empty, we're adding a new series
            if (index === -1) {
                const radius = this.props.pointRadius ? this.props.pointRadius : 4
                this.chart.data.datasets.push({
                    borderColor: this.props.colors[datalabels.length],
                    pointStyle: this.props.pointShape || 'circle',
                    pointRadius: radius,
                    pointHoverRadius: radius * 1.25,
                    label,
                    data: [datapoint]
                })
            } else {
                // we're adding a new datapoint to an existing series
                this.chart.data.datasets[index].data.push(datapoint)
            }
        },
        /**
         * Function to handle adding a data point to Bar Charts
         * @param {*} payload
         * @param {*} label
         */
        addToBar (payload, label) {
            label = label || ''
            // construct our datapoint
            if (typeof payload === 'number') {
                // is this series already a label in the chart?
                if (this.chart.data.labels.includes(label)) {
                    // yes, so we need to find the index of this label
                    const index = this.chart.data.labels.indexOf(label)
                    // and update the data at this index
                    this.chart.data.datasets[0].data[index] = payload
                } else {
                    // no, so we need to add new label and data point
                    if (!this.chart.data.datasets.length) {
                        this.chart.data.datasets.push({
                            data: [],
                            backgroundColor: this.props.colors,
                            borderColor: this.props.colors
                        })
                    }
                    this.chart.data.datasets[0].data.push(payload)
                    this.chart.data.labels.push(label)
                }
            } else if (typeof payload === 'object') {
                if (!this.chart.data.labels.includes(label)) {
                    if (!this.chart.data.datasets.length) {
                        this.chart.data.datasets.push({
                            data: [],
                            backgroundColor: this.props.colors,
                            borderColor: this.props.colors
                        })
                    }
                    this.chart.data.labels.push(label)
                }
                const index = this.chart.data.labels.indexOf(label)
                // ChartJS supports objects for Bar Charts, as long as we have xAxisKey and yAxisKey set
                // and update the data at this index
                if (this.props.categoryType === 'json' && this.props.category.length > 0) {
                    // we would have computed these values server-side for multiple series defined
                    this.chart.data.datasets[0].data[index] = payload.y
                } else {
                    this.chart.data.datasets[0].data[index] = payload
                }
            } else {
                // only support numbers for now
                console.log('Unsupported payload type for Bar Chart:', typeof payload)
            }
        },
        limitDataSize () {
            let cutoff = null
            let points = null
            if (this.props.xAxisType === 'time' && this.props.removeOlder && this.props.removeOlderUnit) {
                const removeOlder = parseFloat(this.props.removeOlder)
                const removeOlderUnit = parseFloat(this.props.removeOlderUnit)
                const ago = (removeOlder * removeOlderUnit) * 1000 // milliseconds ago
                cutoff = (new Date()).getTime() - ago
            }

            if (this.props.removeOlderPoints) {
                // remove older points
                points = parseInt(this.props.removeOlderPoints)
            }

            // apply data limitations to the chart
            if (points && this.chart.data.datasets.length > 0) {
                for (let i = 0; i < this.chart.data.datasets.length; i++) {
                    const length = this.chart.data.datasets[i].data.length
                    this.chart.data.datasets[i].data = this.chart.data.datasets[i].data.filter((d, i) => {
                        if (cutoff && d.x < cutoff) {
                            return false
                        } else if (i < length - points) {
                            return false
                        }
                        return true
                    })
                }
            }

            // apply data limtations to the vuex store
            this.$store.commit('data/restrict', {
                widgetId: this.id,
                min: cutoff,
                points
            })
        }
    }
}
</script>

<style scoped>
</style>
