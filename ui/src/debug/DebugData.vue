<template>
    <pre v-if="data && Array.isArray(data) && data.length > 10" style="padding: 12px; opacity: 0.5;">Array&lt;{{ data.length }}&gt;

{{ data.slice(0, 10) }}
... [+ {{ data.length - 10 }} more]
    </pre>
    <pre v-else-if="data" style="padding: 12px; opacity: 0.5;">{{ data }}</pre>
    <p v-else style="padding: 12px; opacity: 0.5;">No Data Found</p>
    <v-btn style="margin: 12px;" variant="outlined" prepend-icon="mdi-refresh" @click="getData()">Refresh</v-btn>
</template>

<script>
export default {
    name: 'DebugData',
    props: {
        item: { type: String, required: true },
        store: { type: String, required: true }
    },
    data () {
        return {
            data: null
        }
    },
    created () {
        this.getData()
    },
    mounted () {
        this.getData()
    },
    methods: {
        getData () {
            const xhr = new XMLHttpRequest()
            xhr.open('GET', `/dashboard/_debug/${this.store}store/${this.item}`)
            xhr.send()
            xhr.responseType = 'json'
            xhr.onload = () => {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    const data = xhr.response
                    this.data = data
                } else {
                    console.error(`Error: ${xhr.status}`)
                }
            }
        }
    }
}
</script>
